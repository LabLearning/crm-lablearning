import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { PositionnementPoeiPDF, type CandidatPositionne } from '@/lib/pdf/positionnement-poei-pdf'

export const dynamic = 'force-dynamic'

/**
 * Fiches de positionnement à l'entrée d'un parcours POEI, pour France Travail.
 *
 *   /api/pdf/poei-positionnement/<parcours>[?candidat=<uuid>]
 *
 * Un candidat par page : niveau constaté, écart au référentiel de compétences
 * et volume d'heures que cet écart justifie.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, date_debut, date_fin, duree_heures, poste_vise, client:client_id(raison_sociale, nom_commercial)')
    .eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!poei) return NextResponse.json({ error: 'Parcours POEI introuvable' }, { status: 404 })

  const candidatId = req.nextUrl.searchParams.get('candidat') || ''
  let q = supabase.from('poei_positionnements')
    .select('candidat_id, reponses, realise_le, commentaire')
    .eq('poei_id', params.id).eq('organization_id', orgId)
  if (candidatId) q = q.eq('candidat_id', candidatId)
  const { data: positions, error } = await q
  if (error) {
    return NextResponse.json({ error: "Positionnements indisponibles : appliquez la migration 152." }, { status: 503 })
  }
  if (!positions?.length) {
    return NextResponse.json({ error: 'Aucun positionnement réalisé sur ce parcours' }, { status: 404 })
  }

  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('id, identifiant_ft, statut, apprenant:apprenants(prenom, nom, date_naissance)')
    .eq('poei_id', params.id).eq('organization_id', orgId)
  const parId = new Map((candidats || []).map((c: any) => [c.id, c]))

  const liste: CandidatPositionne[] = (positions as any[])
    .map((p) => {
      const c: any = parId.get(p.candidat_id)
      if (!c?.apprenant) return null
      return {
        nom: c.apprenant.nom || '', prenom: c.apprenant.prenom || '',
        dateNaissance: c.apprenant.date_naissance || null,
        identifiantFt: c.identifiant_ft || null,
        reponses: p.reponses || {},
        realiseLe: p.realise_le || null,
        commentaire: p.commentaire || null,
      }
    })
    .filter((x): x is CandidatPositionne => !!x)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  if (!liste.length) return NextResponse.json({ error: 'Aucun candidat à présenter' }, { status: 404 })

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)
  const cl: any = (poei as any).client
  const numero = `POS-${(poei as any).numero || String(params.id).slice(0, 8)}`

  const buffer = await renderToBuffer(
    createElement(PositionnementPoeiPDF, {
      org, poei: poei as any,
      employeur: cl?.nom_commercial || cl?.raison_sociale || null,
      candidats: liste, numero,
    }) as any,
  )

  const nom = candidatId && liste[0]
    ? `Positionnement - ${liste[0].nom} ${liste[0].prenom}`
    : `Positionnements - ${(poei as any).numero || 'POEI'}`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_')}.pdf"`,
    },
  })
}
