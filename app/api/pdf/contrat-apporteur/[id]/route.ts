import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ContratApporteurPDF } from '@/lib/pdf/contrat-apporteur-pdf'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  const { data: apporteur } = await supabase.from('apporteurs_affaires').select('*').eq('id', params.id).single()
  if (!apporteur) return NextResponse.json({ error: 'Apporteur introuvable' }, { status: 404 })

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apporteur.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(createElement(ContratApporteurPDF, { apporteur, org }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrat-apporteur-${apporteur.nom}.pdf"`,
    },
  })
}
