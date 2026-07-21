import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { EmargementPDF } from '@/lib/pdf/emargement-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('*, formateur:formateurs(prenom, nom)')
    .eq('id', params.id).single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  // Le formateur imprime la feuille vierge depuis son portail : pas de session
  // Supabase, l'accès est prouvé par le token et la session doit être la sienne.
  const portalToken = new URL(req.url).searchParams.get('token')
  if (portalToken) {
    const { getPortalContext } = await import('@/lib/portal-auth')
    const context = await getPortalContext(portalToken)
    if (!context || context.type !== 'formateur' || session.formateur_id !== context.formateur.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  } else {
    const anonClient = await createServerSupabaseClient()
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: formation } = await supabase.from('formations').select('*').eq('id', session.formation_id).single()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', session.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(prenom, nom, entreprise)')
    .eq('session_id', params.id)
    .not('status', 'in', '("annule","abandonne")')
  const apprenants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)

  const buffer = await renderToBuffer(
    createElement(EmargementPDF, { session, formation, org, formateur: (session as any).formateur, apprenants }) as any
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="emargement-${session.reference || session.id}.pdf"`,
    },
  })
}
