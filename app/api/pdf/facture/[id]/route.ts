import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import type { Facture } from '@/lib/types/facture'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: facture, error } = await supabase
    .from('factures')
    .select(`
      *,
      client:clients(raison_sociale, nom, prenom, type, email, adresse, code_postal, ville, siret, tva_intra),
      formation:formations(intitule),
      lignes:facture_lignes(*),
      paiements(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !facture) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  const { data: orgRaw } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (facture as any).organization_id)
    .single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(FacturePDF, { facture: facture as Facture, org }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${facture.numero}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
