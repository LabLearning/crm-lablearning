import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { CompteRenduFormationPDF } from '@/lib/pdf/compte-rendu-formation-pdf'
import { compteRenduStocke } from '@/lib/compte-rendu'

/**
 * Compte rendu de formation d'une session, en PDF, pour le dossier. Réservé à
 * l'équipe qui a accès aux sessions.
 */
export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()

  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', orgId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/sessions', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const { data: s } = await supabase.from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, adresse, code_postal, ville, formation_id, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale, nom_commercial)')
    .eq('id', params.sessionId).eq('organization_id', orgId).maybeSingle()
  if (!s) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const [{ data: rapports }, { data: orgRaw }] = await Promise.all([
    supabase.from('rapports_session').select('*, formateur:formateur_id(prenom, nom)')
      .eq('session_id', s.id).eq('organization_id', orgId)
      .order('submitted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(1),
    supabase.from('organizations').select('*').eq('id', orgId).single(),
  ])
  const r: any = rapports?.[0]
  if (!r) return NextResponse.json({ error: 'Aucun compte rendu pour cette session' }, { status: 404 })

  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const ss: any = s
  const jour = (d: string | null) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const heures = ss.formation?.duree_heures
  const buffer = await renderToBuffer(createElement(CompteRenduFormationPDF, {
    org,
    entete: {
      reference: ss.reference || 'Session',
      formation: ss.formation?.intitule || ss.intitule || 'Formation',
      client: ss.client?.nom_commercial || ss.client?.raison_sociale || null,
      periode: ss.date_debut ? (ss.date_fin && ss.date_fin !== ss.date_debut ? `du ${jour(ss.date_debut)} au ${jour(ss.date_fin)}` : `le ${jour(ss.date_debut)}`) : null,
      lieu: [ss.lieu, ss.adresse, [ss.code_postal, ss.ville].filter(Boolean).join(' ')].map((x: any) => String(x || '').trim()).filter(Boolean).join(', ') || null,
      duree: heures ? `${Number(heures).toLocaleString('fr-FR')} h` : null,
      formateur: r.formateur ? `${r.formateur.prenom || ''} ${r.formateur.nom || ''}`.trim() : null,
      transmisLe: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : null,
      statut: r.status === 'valide' ? 'Validé' : r.status === 'soumis' ? 'Transmis' : 'Brouillon',
    },
    cr: compteRenduStocke(r),
    ancien: [
      ['Contenu abordé', r.contenu_aborde], ['Objectifs atteints', r.objectifs_atteints],
      ['Objectifs non atteints', r.objectifs_non_atteints], ['Difficultés rencontrées', r.difficultes_rencontrees],
      ['Points positifs', r.points_positifs], ['Recommandations', r.recommandations], ['Commentaires généraux', r.commentaires_generaux],
    ],
  }) as any)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compte-rendu-${ss.reference || ss.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
