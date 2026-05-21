/**
 * Ingestion d'audits depuis un outil externe (audit hygiène terrain).
 *
 * POST /api/audits/ingest
 * Header : Authorization: Bearer ll_audit_xxxxxxxx
 * Body JSON :
 * {
 *   "siret": "12345678900012",          // identifiant prioritaire de l'établissement
 *   "etablissement_nom": "Brioche...",   // fallback si pas de SIRET
 *   "client_id": "uuid",                  // ou directement l'ID CRM
 *   "formateur_email": "x@y.fr",          // optionnel : auteur de l'audit
 *   "date_audit": "2026-05-18",           // défaut : aujourd'hui
 *   "type_audit": "hygiene",              // hygiene / conformite / qualite / autre
 *   "note_globale": 17.5,
 *   "note_sur": 20,                        // barème (20 ou 100), défaut 20
 *   "points_forts": "…",
 *   "points_amelioration": "…",
 *   "bilan": "…",
 *   "commentaires": "…",
 *   "fichier_url": "https://…/rapport.pdf"
 * }
 *
 * Réponse 201 : { success, audit_id, client: { id, raison_sociale }, franchise_id }
 * Réponse 401 : clé invalide · 422 : établissement introuvable · 400 : payload invalide
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyApiKey } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

function normalizeSiret(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const digits = s.replace(/\D/g, '')
  return digits.length >= 9 ? digits : null
}

export async function POST(req: Request) {
  const supabase = await createServiceRoleClient()

  // 1. Auth par clé API
  const auth = await verifyApiKey(supabase, req.headers.get('authorization') || '', 'audits:write')
  if (!auth) {
    return NextResponse.json({ error: 'Clé API invalide ou révoquée' }, { status: 401 })
  }
  const orgId = auth.organizationId

  // 2. Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  // 3. Résoudre l'établissement (client) : par client_id, sinon SIRET, sinon nom exact
  let client: { id: string; raison_sociale: string; franchise_id: string | null } | null = null

  if (body.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, raison_sociale, franchise_id')
      .eq('id', body.client_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    client = data || null
  }

  if (!client) {
    const siret = normalizeSiret(body.siret)
    if (siret) {
      const { data } = await supabase
        .from('clients')
        .select('id, raison_sociale, franchise_id, siret')
        .eq('organization_id', orgId)
        .ilike('siret', `${siret}%`)
        .limit(1)
        .maybeSingle()
      client = data || null
    }
  }

  if (!client && body.etablissement_nom) {
    const { data } = await supabase
      .from('clients')
      .select('id, raison_sociale, franchise_id')
      .eq('organization_id', orgId)
      .ilike('raison_sociale', `${String(body.etablissement_nom).trim()}%`)
      .limit(1)
      .maybeSingle()
    client = data || null
  }

  if (!client) {
    return NextResponse.json(
      {
        error: 'Établissement introuvable',
        hint: 'Fournissez un SIRET correspondant à un client du CRM (ou client_id / etablissement_nom).',
        received: { siret: body.siret, etablissement_nom: body.etablissement_nom, client_id: body.client_id },
      },
      { status: 422 },
    )
  }

  // 4. Auteur (formateur) optionnel, via email
  let auteurId: string | null = null
  if (body.formateur_email) {
    const { data: u } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('email', String(body.formateur_email).trim())
      .maybeSingle()
    auteurId = u?.id || null
  }

  // 5. Validation minimale
  const noteSur = Number(body.note_sur) || 20
  const noteGlobale = body.note_globale != null ? Number(body.note_globale) : null
  if (noteGlobale != null && (isNaN(noteGlobale) || noteGlobale < 0 || noteGlobale > noteSur)) {
    return NextResponse.json({ error: `note_globale doit être entre 0 et ${noteSur}` }, { status: 400 })
  }
  if (noteGlobale == null && !body.bilan && !body.commentaires) {
    return NextResponse.json({ error: 'Fournissez au moins une note ou un bilan' }, { status: 400 })
  }

  // 6. Insert audit
  const { data: audit, error } = await supabase
    .from('audits_etablissement')
    .insert({
      organization_id: orgId,
      client_id: client.id,
      franchise_id: client.franchise_id,
      date_audit: body.date_audit || new Date().toISOString().split('T')[0],
      type_audit: body.type_audit || 'hygiene',
      note_globale: noteGlobale,
      note_sur: noteSur,
      points_forts: body.points_forts || null,
      points_amelioration: body.points_amelioration || null,
      bilan: body.bilan || null,
      commentaires: body.commentaires || null,
      fichier_url: body.fichier_url || null,
      auteur_id: auteurId,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[audit ingest]', error)
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement', details: error.message }, { status: 500 })
  }

  // 7. Notifier les admins/gestionnaires
  try {
    const { createNotifications } = await import('@/lib/email')
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', orgId)
      .in('role', ['super_admin', 'gestionnaire'])
      .eq('status', 'active')
    if (admins && admins.length > 0) {
      await createNotifications(
        admins.map((a: any) => ({
          organizationId: orgId,
          userId: a.id,
          titre: 'Nouvel audit reçu',
          message: `Audit ${body.type_audit || 'hygiène'} pour ${client!.raison_sociale}${noteGlobale != null ? ` — note ${noteGlobale}/${noteSur}` : ''}`,
          type: 'info',
          lienUrl: '/dashboard/audits',
          lienLabel: 'Voir l\'audit',
          entityType: 'audit_etablissement',
          entityId: audit.id,
        })),
      )
    }
  } catch (e) {
    console.error('[audit ingest notify]', e)
  }

  return NextResponse.json({
    success: true,
    audit_id: audit.id,
    client: { id: client.id, raison_sociale: client.raison_sociale },
    franchise_id: client.franchise_id,
  }, { status: 201 })
}
