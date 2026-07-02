import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ContratFormateurPDF } from '@/lib/pdf/contrat-formateur-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session')

  const { data: formateur } = await supabase.from('formateurs').select('*').eq('id', params.id).single()
  if (!formateur) return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', formateur.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  let session = null
  if (sessionId) {
    const { data } = await supabase.from('sessions').select('*, formation:formation_id(intitule, duree_heures)').eq('id', sessionId).single()
    session = data
  }

  const buffer = await renderToBuffer(createElement(ContratFormateurPDF, { formateur, org, session }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrat-prestation-${formateur.nom}.pdf"`,
    },
  })
}
