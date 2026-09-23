import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { CertificatRealisationPDF } from '@/lib/pdf/certificat-realisation-pdf'

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

  const { data: session } = await supabase.from('sessions').select('*, client:client_id(raison_sociale, nom_commercial)').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { data: formation } = await supabase.from('formations').select('*').eq('id', session.formation_id).single()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Heures certifiées : durée du parcours POEI, sinon durée prévue moins les
  // absences déclarées — une demi-journée non signée n'est pas une absence
  const { heuresCertificat } = await import('@/lib/certificat-heures')
  const h = await heuresCertificat(supabase, {
    sessionId, apprenantId: params.id, organizationId: auth.user.organizationId, dureeFormation: formation?.duree_heures,
  })
  const assiduite = h.assiduite
  const heuresPresence = h.heures || undefined
  const dureeTotale = h.dureeTotale || undefined

  // Signature électronique du bénéficiaire (POEI) : recherchée par apprenant,
  // sur la POEI liée à la session si elle existe, sinon la plus récente.
  let signatureCandidat: any = null
  let dateSignature: string | null = null
  try {
    const { data: sigs } = await supabase
      .from('certificat_signatures')
      .select('signature_data, signataire_nom, signed_at, date_signature, poei_id, session_id')
      .eq('organization_id', auth.user.organizationId)
      .eq('apprenant_id', params.id)
      .order('signed_at', { ascending: false, nullsFirst: false })
    const list = sigs || []
    const match = list.find((x: any) => x.session_id === sessionId) || list[0]
    if (match) {
      dateSignature = match.date_signature || null
      if (match.signature_data) {
        signatureCandidat = { data: match.signature_data, nom: match.signataire_nom, signedAt: match.signed_at }
      }
    }
  } catch { /* table absente avant migration 109 */ }

  const buffer = await renderToBuffer(createElement(CertificatRealisationPDF, { apprenant, session, formation, org, assiduite, heuresPresence, dureeTotale, signatureCandidat, dateSignature }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificat-realisation-${apprenant.nom}.pdf"`,
    },
  })
}
