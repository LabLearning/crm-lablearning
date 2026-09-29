import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { CompteRenduFormationPDF, CompteRenduPapierPDF } from '@/lib/pdf/compte-rendu-formation-pdf'
import {
  compteRenduStocke, METHODES, MODALITES_EVALUATION, NIVEAUX_GROUPE, PARTICIPATIONS, SALLES,
} from '@/lib/compte-rendu'

/**
 * Compte rendu de formation d'une session, en PDF, pour le dossier.
 * ?vierge=1 : la fiche à remplir à la main, avec les demi-journées, les
 * objectifs et les stagiaires de la session.
 *
 * Réservé à l'équipe qui a accès aux sessions, et au formateur de la session.
 */
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()
  const vierge = req.nextUrl.searchParams.get('vierge') === '1'

  // Le formateur n'accède qu'aux sessions qu'il anime ; l'équipe, selon ses droits
  let formateurId: string | null = null
  if (auth.user.role === 'formateur') {
    const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', auth.user.id).maybeSingle()
    if (!f) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    formateurId = f.id
  } else {
    const { data: permissions } = await supabase.from('permissions').select('*')
      .eq('organization_id', orgId).eq('role', auth.user.role)
    const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
    if (!checkDashboardAccess('/dashboard/sessions', auth.user.role as any, (permissions || []) as any).allowed) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
  }

  const { data: s } = await supabase.from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, adresse, code_postal, ville, formation_id, formateur_id, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale, nom_commercial), formateur:formateur_id(prenom, nom)')
    .eq('id', params.sessionId).eq('organization_id', orgId).maybeSingle()
  if (!s || (formateurId && (s as any).formateur_id !== formateurId)) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const [{ data: rapports }, { data: orgRaw }] = await Promise.all([
    vierge
      ? Promise.resolve({ data: [] as any[] })
      : supabase.from('rapports_session').select('*, formateur:formateur_id(prenom, nom)')
        .eq('session_id', s.id).eq('organization_id', orgId)
        .order('submitted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(1),
    supabase.from('organizations').select('*').eq('id', orgId).single(),
  ])
  const r: any = rapports?.[0]
  if (!vierge && !r) return NextResponse.json({ error: 'Aucun compte rendu pour cette session' }, { status: 404 })

  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const ss: any = s
  const jour = (d: string | null) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const heures = ss.formation?.duree_heures
  const nom = (f: any) => (f ? `${f.prenom || ''} ${f.nom || ''}`.trim() || null : null)
  const entete = {
    reference: ss.reference || 'Session',
    formation: ss.formation?.intitule || ss.intitule || 'Formation',
    client: ss.client?.nom_commercial || ss.client?.raison_sociale || null,
    periode: ss.date_debut ? (ss.date_fin && ss.date_fin !== ss.date_debut ? `du ${jour(ss.date_debut)} au ${jour(ss.date_fin)}` : `le ${jour(ss.date_debut)}`) : null,
    lieu: [ss.lieu, ss.adresse, [ss.code_postal, ss.ville].filter(Boolean).join(' ')].map((x: any) => String(x || '').trim()).filter(Boolean).join(', ') || null,
    duree: heures ? `${Number(heures).toLocaleString('fr-FR')} h` : null,
    formateur: nom(r?.formateur) || nom(ss.formateur),
    transmisLe: r?.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : null,
    statut: !r ? 'À remplir' : r.status === 'valide' ? 'Validé' : r.status === 'soumis' ? 'Transmis' : 'Brouillon',
  }

  let buffer: Buffer
  if (vierge) {
    const { compteRenduSession } = await import('@/lib/compte-rendu-data')
    const cr = await compteRenduSession(supabase, ss, null)
    buffer = await renderToBuffer(createElement(CompteRenduPapierPDF, {
      org, entete, cr,
      listes: { methodes: METHODES, modalites: MODALITES_EVALUATION, niveaux: NIVEAUX_GROUPE, participations: PARTICIPATIONS, salles: SALLES },
    }) as any)
  } else {
    buffer = await renderToBuffer(createElement(CompteRenduFormationPDF, {
      org, entete,
      cr: compteRenduStocke(r),
      ancien: [
        ['Contenu abordé', r.contenu_aborde], ['Objectifs atteints', r.objectifs_atteints],
        ['Objectifs non atteints', r.objectifs_non_atteints], ['Difficultés rencontrées', r.difficultes_rencontrees],
        ['Points positifs', r.points_positifs], ['Recommandations', r.recommandations], ['Commentaires généraux', r.commentaires_generaux],
      ],
    }) as any)
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compte-rendu-${vierge ? 'a-remplir-' : ''}${ss.reference || ss.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
