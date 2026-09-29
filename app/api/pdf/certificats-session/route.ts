import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { withDocumentLogo } from '@/lib/pdf/org-logo'
import { CertificatsSessionPDF } from '@/lib/pdf/certificat-realisation-pdf'

export const dynamic = 'force-dynamic'

/**
 * Tous les certificats de réalisation d'une session, un stagiaire par page.
 *
 * Le financeur les demande par action, pas par personne : les télécharger un
 * par un sur une session de quinze stagiaires n'est pas un mode opératoire.
 *
 *   /api/pdf/certificats-session?session=<uuid>
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId

  const sessionId = req.nextUrl.searchParams.get('session') || ''
  if (!sessionId) return NextResponse.json({ error: 'Session requise' }, { status: 400 })

  const supabase = await createServiceRoleClient()

  const [{ data: orgRow }, { data: sess }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    supabase.from('sessions')
      .select('*, formateur:formateurs(prenom, nom), client:client_id(raison_sociale, nom_commercial)')
      .eq('id', sessionId).eq('organization_id', orgId).maybeSingle(),
  ])
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const [{ data: formation }, { data: inscriptions }] = await Promise.all([
    supabase.from('formations').select('*').eq('id', (sess as any).formation_id).maybeSingle(),
    supabase.from('inscriptions')
      .select('apprenant:apprenants(*)')
      .eq('session_id', sessionId)
      .not('status', 'in', '("annule","abandonne")'),
  ])

  const apprenants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)
    .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
  if (apprenants.length === 0) {
    return NextResponse.json({ error: 'Aucun stagiaire sur cette session' }, { status: 404 })
  }

  // Heures et assiduité de chacun, comme sur le certificat individuel : une
  // demi-journée non signée n'est pas une absence, seule l'absence déclarée compte.
  const duree = Number((formation as any)?.duree_heures || 0)
  const { heuresCertificats } = await import('@/lib/certificat-heures')
  const heures = await heuresCertificats(supabase, { sessionId, organizationId: orgId, dureeFormation: duree })
  const stagiaires = apprenants.map((a: any) => {
    const h = heures.get(a.id)
    if (!h) return { apprenant: a }
    return { apprenant: a, assiduite: h.assiduite, heuresPresence: h.heures }
  })

  const org = await withDocumentLogo(supabase, orgRow)
  const buffer = await renderToBuffer(
    createElement(CertificatsSessionPDF, { stagiaires, session: sess, formation, org }) as any,
  )

  const nom = `certificats-${(sess as any).reference || 'session'}`.replace(/[^\w.-]/g, '_')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom}.pdf"`,
    },
  })
}
