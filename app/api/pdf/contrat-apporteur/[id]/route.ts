import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { ContratApporteurPDF } from '@/lib/pdf/contrat-apporteur-pdf'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  // Contrôle d'org : l'apporteur doit appartenir à l'organisation de l'appelant.
  const { data: apporteur } = await supabase.from('apporteurs_affaires').select('*').eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
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
