import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AvenantConventionPDF } from '@/lib/pdf/avenant-convention-pdf'
import { loadConventionForPdf } from '@/lib/pdf/convention-data'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: avenant } = await supabase
    .from('convention_avenants')
    .select('*')
    .eq('id', params.id)
    .single()
  if (!avenant) return NextResponse.json({ error: 'Avenant introuvable' }, { status: 404 })

  const loaded = await loadConventionForPdf(supabase, avenant.convention_id)
  if (!loaded) return NextResponse.json({ error: 'Convention introuvable' }, { status: 404 })

  const buffer = await renderToBuffer(
    createElement(AvenantConventionPDF, { avenant, convention: loaded.convention, org: loaded.org }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="avenant-${avenant.numero}-${loaded.convention.numero || ''}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
