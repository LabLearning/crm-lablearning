import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { AttestationFormationPDF } from '@/lib/pdf/attestation-formation-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session')

  if (!sessionId) return NextResponse.json({ error: 'Session requise' }, { status: 400 })

  // Contrôle d'org : l'apprenant doit appartenir à l'organisation de l'appelant.
  const { data: apprenant } = await supabase.from('apprenants').select('*').eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!apprenant) return NextResponse.json({ error: 'Apprenant introuvable' }, { status: 404 })

  const { data: session } = await supabase.from('sessions').select('*, formateur:formateurs(prenom, nom)').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { data: formation } = await supabase.from('formations').select('*').eq('id', session.formation_id).single()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Heures et assiduité selon la règle commune des certificats : une
  // demi-journée non signée n'est pas une absence (feuille papier, signature
  // oubliée), seule compte l'absence déclarée par le formateur ; une POEI porte
  // la durée de son parcours ou les heures effectuées du candidat.
  const dureeTheorique = Number(formation?.duree_heures) || null
  const { heuresCertificats } = await import('@/lib/certificat-heures')
  const h = (await heuresCertificats(supabase, {
    sessionId, organizationId: auth.user.organizationId, dureeFormation: dureeTheorique,
  })).get(params.id)
  const assiduite = h?.assiduite
  // Heures de présence saisies à la main sur l'inscription : elles priment
  const { data: insc } = await supabase.from('inscriptions')
    .select('heures_presence').eq('session_id', sessionId).eq('apprenant_id', params.id).maybeSingle()
  const saisies = Number(insc?.heures_presence) > 0 ? Number(insc!.heures_presence) : null
  let heuresSuivies: number | null = saisies ?? (h ? h.heures : null)
  // Une valeur égale (ou supérieure) à la durée prévue n'apporte rien : on
  // n'affiche le distinguo que quand le parcours est réellement partiel.
  const reference = h?.dureeTotale || dureeTheorique
  if (heuresSuivies != null && reference && heuresSuivies >= reference) heuresSuivies = null

  const buffer = await renderToBuffer(createElement(AttestationFormationPDF, { apprenant, session, formation, org, assiduite, heuresSuivies }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attestation-${apprenant.nom}-${apprenant.prenom}.pdf"`,
    },
  })
}
