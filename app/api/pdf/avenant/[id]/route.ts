import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { AvenantConventionPDF } from '@/lib/pdf/avenant-convention-pdf'
import { loadConventionForPdf } from '@/lib/pdf/convention-data'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  // Contrôle d'org : convention_avenants porte organization_id (migration 069).
  const { data: avenant } = await supabase
    .from('convention_avenants')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', auth.user.organizationId)
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
