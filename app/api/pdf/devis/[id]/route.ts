import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { DevisPDF } from '@/lib/pdf/devis-pdf'
import type { Devis } from '@/lib/types/dossier'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  // Contrôle d'org : le devis doit appartenir à l'organisation de l'appelant.
  const { data: devis, error } = await supabase
    .from('devis')
    .select(`
      *,
      client:clients(raison_sociale, nom, prenom, type, email, adresse, code_postal, ville, siret, tva_intra),
      contact:contacts(prenom, nom, email),
      formation:formations(intitule, reference),
      lignes:devis_lignes(*)
    `)
    .eq('id', params.id)
    .eq('organization_id', auth.user.organizationId)
    .single()

  if (error || !devis) {
    return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  }

  const { data: orgRaw } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (devis as any).organization_id)
    .single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(DevisPDF, { devis: devis as Devis, org }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="devis-${devis.numero}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
