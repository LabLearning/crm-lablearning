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
  let poeiId = searchParams.get('poei')

  if (!sessionId && !poeiId) return NextResponse.json({ error: 'Session ou POEI requise' }, { status: 400 })

  // Contrôle d'org : l'apprenant doit appartenir à l'organisation de l'appelant.
  const { data: apprenant } = await supabase.from('apprenants').select('*').eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!apprenant) return NextResponse.json({ error: 'Apprenant introuvable' }, { status: 404 })

  // Une session d'un parcours POEI (chapeau ou intervention) : le certificat porte le parcours entier
  if (!poeiId && sessionId) {
    const { poeiDeLaSession } = await import('@/lib/certificat-heures')
    poeiId = (await poeiDeLaSession(supabase, sessionId, auth.user.organizationId))?.id || null
  }

  let session: any
  let formation: any
  let assiduite: number | undefined
  let heuresPresence: number | undefined
  let dureeTotale: number | undefined
  let dateParcours: string | null = null
  if (poeiId) {
    // POEI : dates, durée et lieu du parcours, avec ou sans session chapeau
    const { contexteCertificatPoei } = await import('@/lib/certificat-poei')
    const ctx = await contexteCertificatPoei(supabase, poeiId, auth.user.organizationId)
    if (!ctx) return NextResponse.json({ error: 'POEI introuvable' }, { status: 404 })
    const h = ctx.heures.get(String(params.id))
    if (!h) return NextResponse.json({ error: 'Ce stagiaire n’est pas candidat de cette POEI' }, { status: 404 })
    session = ctx.session
    formation = ctx.formation
    // Comme le certificat groupé : l'entreprise du stagiaire est l'établissement du projet POEI
    if (!apprenant.entreprise && ctx.entrepriseNom) apprenant.entreprise = ctx.entrepriseNom
    heuresPresence = h.heures || undefined
    dureeTotale = h.dureeTotale || undefined
    dateParcours = ctx.dateParcours
  } else {
    const { data: s } = await supabase.from('sessions').select('*, client:client_id(raison_sociale, nom_commercial)').eq('id', sessionId).eq('organization_id', auth.user.organizationId).single()
    if (!s) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    session = s
    const { data: f } = await supabase.from('formations').select('*').eq('id', s.formation_id).single()
    formation = f
    // Heures certifiées : durée prévue moins les absences déclarées — une demi-journée non signée n'est pas une absence
    const { heuresCertificat } = await import('@/lib/certificat-heures')
    const h = await heuresCertificat(supabase, {
      sessionId: s.id, apprenantId: params.id, organizationId: auth.user.organizationId, dureeFormation: f?.duree_heures,
    })
    assiduite = h.assiduite
    heuresPresence = h.heures || undefined
    dureeTotale = h.dureeTotale || undefined
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

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
    const match = (poeiId && list.find((x: any) => x.poei_id === poeiId))
      || (sessionId && list.find((x: any) => x.session_id === sessionId))
      || list[0]
    if (match) {
      dateSignature = match.date_signature || null
      if (match.signature_data) {
        signatureCandidat = { data: match.signature_data, nom: match.signataire_nom, signedAt: match.signed_at }
      }
    }
  } catch { /* table absente avant migration 109 */ }

  // POEI : à défaut de date de signature, le certificat est daté de la fin du parcours
  if (!dateSignature && dateParcours) dateSignature = dateParcours
  const buffer = await renderToBuffer(createElement(CertificatRealisationPDF, { apprenant, session, formation, org, assiduite, heuresPresence, dureeTotale, signatureCandidat, dateSignature }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificat-realisation-${apprenant.nom}.pdf"`,
    },
  })
}
