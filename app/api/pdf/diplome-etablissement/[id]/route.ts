import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { estFormationHygiene } from '@/lib/formation-hygiene'
import { DiplomeEtablissementPDF } from '@/lib/pdf/diplome-etablissement-pdf'

/** Intitulé porté sur les documents du module hygiène d'un parcours POEI. */
const INTITULE_MODULE_HYGIENE = 'Hygiène alimentaire et prévention des risques'

/**
 * Diplôme d'établissement (hygiène). Document d'affichage, au nom de
 * l'établissement et de ses stagiaires.
 *
 *   /api/pdf/diplome-etablissement/<session>
 *   /api/pdf/diplome-etablissement/<parcours POEI>?poei=1
 *
 * Sur une POEI, le module hygiène est un volet du parcours et non une session
 * typée hygiène : le contrôle d'intitulé ne s'applique pas.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  if (new URL(req.url).searchParams.get('poei')) {
    return diplomePoei(supabase, auth.user.organizationId, params.id)
  }
  const { data: sess } = await supabase.from('sessions')
    .select('id, date_debut, date_fin, ville, formation:formation_id(intitule, categorie), client:client_id(raison_sociale, nom_commercial, ville), formateur:formateurs(prenom, nom)')
    .eq('id', params.id).eq('organization_id', auth.user.organizationId).maybeSingle()
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  if (!estFormationHygiene((sess as any).formation)) {
    return NextResponse.json({ error: "Cette session ne porte pas sur l'hygiène alimentaire" }, { status: 400 })
  }
  const client: any = (sess as any).client
  if (!client) return NextResponse.json({ error: 'Aucun établissement rattaché à la session' }, { status: 400 })

  const { data: insc } = await supabase.from('inscriptions')
    .select('apprenant:apprenants(prenom, nom)')
    .eq('session_id', sess.id).not('status', 'in', '("annule","abandonne")')

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', auth.user.organizationId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(DiplomeEtablissementPDF, {
      org,
      etablissement: client.nom_commercial || client.raison_sociale || 'Établissement',
      ville: client.ville || (sess as any).ville || null,
      formationIntitule: (sess as any).formation?.intitule || 'Hygiène alimentaire',
      dateDebut: sess.date_debut,
      dateFin: sess.date_fin,
      stagiaires: (insc || []).map((i: any) => i.apprenant).filter(Boolean),
      formateurNom: (sess as any).formateur ? `${(sess as any).formateur.prenom} ${(sess as any).formateur.nom}` : null,
    }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="diplome-${(client.nom_commercial || client.raison_sociale || 'etablissement').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf"`,
    },
  })
}

/** Diplôme d'un parcours POEI : mêmes candidats que les attestations d'hygiène. */
async function diplomePoei(supabase: any, orgId: string, poeiId: string): Promise<NextResponse> {
  const { data: poei } = await supabase.from('poei')
    .select('id, numero, date_debut, date_fin, client:client_id(raison_sociale, nom_commercial, ville)')
    .eq('id', poeiId).eq('organization_id', orgId).maybeSingle()
  if (!poei) return NextResponse.json({ error: 'Parcours POEI introuvable' }, { status: 404 })
  const client: any = (poei as any).client
  if (!client) return NextResponse.json({ error: 'Aucun établissement rattaché au parcours' }, { status: 400 })

  const { data: candidats } = await supabase.from('poei_candidats')
    .select('statut, apprenant:apprenants(prenom, nom)')
    .eq('poei_id', poeiId).eq('organization_id', orgId)
  const stagiaires = (candidats || [])
    .filter((c: any) => c.statut !== 'abandonne' && c.apprenant)
    .map((c: any) => c.apprenant)
    .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
  if (!stagiaires.length) return NextResponse.json({ error: 'Aucun candidat actif sur ce parcours' }, { status: 404 })

  // Le formateur du diplôme est celui de la première intervention, comme à l'envoi
  const { data: interventions } = await supabase.from('poei_interventions')
    .select('formateur:formateur_id(prenom, nom)').eq('poei_id', poeiId)
    .order('date_debut', { ascending: true }).limit(1)
  const f: any = (interventions || [])[0]?.formateur

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(DiplomeEtablissementPDF, {
      org,
      etablissement: client.nom_commercial || client.raison_sociale || 'Établissement',
      ville: client.ville || null,
      formationIntitule: INTITULE_MODULE_HYGIENE,
      dateDebut: (poei as any).date_debut,
      dateFin: (poei as any).date_fin,
      stagiaires,
      formateurNom: f ? `${f.prenom} ${f.nom}` : null,
    }) as any,
  )
  const nom = (client.nom_commercial || client.raison_sociale || 'etablissement').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="diplome-${nom}.pdf"`,
    },
  })
}
