import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { checkConventionCompleteness, checkConventionData } from '@/lib/convention-checklist'

export const dynamic = 'force-dynamic'

const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

// Contrôle de conformité de la convention d'une session — AVANT génération.
// Permet d'afficher les manques dans l'aperçu plutôt qu'au moment de l'envoi.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  // Convention déjà créée → contrôle direct
  const { data: existing } = await supabase
    .from('conventions').select('id').eq('session_id', params.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing?.id) {
    const check = await checkConventionCompleteness(supabase, existing.id)
    return NextResponse.json(check || { ok: true, blocking: [], warnings: [] })
  }

  // Sinon : projection depuis la session (mêmes données que l'aperçu PDF)
  const { data: sess } = await supabase
    .from('sessions').select('*, formation:formation_id(*), client:client_id(*)')
    .eq('id', params.id).single()
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { data: inscriptions } = await supabase
    .from('inscriptions').select('apprenant:apprenants(civilite, nom, prenom)')
    .eq('session_id', params.id).not('status', 'in', '("annule","abandonne")')
  const participants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)

  const formation: any = (sess as any).formation
  // Le prix saisi sur la session fait foi ; sinon repli sur le tarif catalogue
  const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
  const montantHt = (sess as any).prix_ht != null
    ? Number((sess as any).prix_ht)
    : (tarifBase ? tarifBase * (participants.length || 1) : null)

  const { data: org } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()

  const check = await checkConventionData(supabase, {
    client: (sess as any).client,
    formation,
    session: sess,
    participants,
    nombre_stagiaires: participants.length,
    duree_heures: formation?.duree_heures || null,
    lieu: sess.lieu || null,
    dates_formation: `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`,
    montant_ht: montantHt,
    taux_tva: 0,
    contact_id: null,
  }, org)

  return NextResponse.json(check)
}
