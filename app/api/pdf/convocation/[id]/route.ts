import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ConvocationPDF } from '@/lib/pdf/convocation-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session')
  if (!sessionId) return NextResponse.json({ error: 'Session requise' }, { status: 400 })

  const { data: apprenant } = await supabase.from('apprenants').select('*').eq('id', params.id).single()
  if (!apprenant) return NextResponse.json({ error: 'Apprenant introuvable' }, { status: 404 })

  const { data: session } = await supabase
    .from('sessions')
    .select('*, formateur:formateurs(prenom, nom)')
    .eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { data: formation } = await supabase.from('formations').select('*').eq('id', session.formation_id).single()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(ConvocationPDF, { apprenant, session, formation, org, formateur: (session as any).formateur }) as any
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convocation-${apprenant.nom}-${apprenant.prenom}.pdf"`,
    },
  })
}
