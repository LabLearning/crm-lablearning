import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { AttestationSortiePDF } from '@/lib/pdf/attestation-sortie-pdf'

/**
 * Attestation de sortie anticipée d'un candidat POEI abandonné.
 * [id] = apprenant, ?poei= & ?candidat= donnent le contexte du dossier.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  const { searchParams } = new URL(req.url)
  const poeiId = searchParams.get('poei')
  const candidatId = searchParams.get('candidat')
  if (!poeiId || !candidatId) return NextResponse.json({ error: 'Contexte requis (poei + candidat)' }, { status: 400 })

  // Contrôle d'org : l'apprenant doit appartenir à l'organisation de l'appelant.
  const { data: apprenant } = await supabase.from('apprenants').select('*').eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!apprenant) return NextResponse.json({ error: 'Apprenant introuvable' }, { status: 404 })

  const { data: p } = await supabase.from('poei').select('*').eq('id', poeiId).eq('organization_id', auth.user.organizationId).single()
  if (!p) return NextResponse.json({ error: 'Projet POEI introuvable' }, { status: 404 })

  const { data: cand } = await supabase.from('poei_candidats').select('*').eq('id', candidatId).eq('poei_id', poeiId).single()
  if (!cand) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })

  const { periodeCandidat } = await import('@/lib/poei-candidat')
  const periode = periodeCandidat(cand as any, p)

  let formation: any = null
  if (p.formation_id) {
    const { data: f } = await supabase.from('formations').select('*').eq('id', p.formation_id).single()
    formation = f
  }
  if (!formation) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })

  let employeur: string | null = null
  if (p.client_id) {
    const { data: cl } = await supabase.from('clients').select('raison_sociale').eq('id', p.client_id).single()
    employeur = cl?.raison_sociale || null
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(AttestationSortiePDF, {
      apprenant,
      formation,
      org,
      // Le candidat entré en cours de parcours atteste de ses propres dates
      dateDebut: periode.debut,
      dateSortie: (cand as any).date_abandon || null,
      dureeHeures: p.duree_heures,
      heuresEffectuees: (cand as any).heures_effectuees ?? (periode.personnalisee ? periode.heures : null),
      motif: (cand as any).motif_abandon || null,
      poei: { identifiant_ft: cand.identifiant_ft, poste_vise: cand.poste_vise, employeur },
    }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attestation-sortie-${apprenant.nom}-${apprenant.prenom || ''}.pdf"`,
    },
  })
}
