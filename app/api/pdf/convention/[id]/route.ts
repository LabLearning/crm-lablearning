import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ConventionPDF } from '@/lib/pdf/convention-pdf'
import type { Convention } from '@/lib/types/dossier'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: convention, error } = await supabase
    .from('conventions')
    .select(`
      *,
      client:clients(raison_sociale),
      formation:formations(intitule)
    `)
    .eq('id', params.id)
    .single()

  if (error || !convention) {
    return NextResponse.json({ error: 'Convention introuvable' }, { status: 404 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (convention as any).organization_id)
    .single()

  const buffer = await renderToBuffer(
    createElement(ConventionPDF, { convention: convention as Convention, org }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="convention-${convention.numero}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
