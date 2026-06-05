import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { DevisPDF } from '@/lib/pdf/devis-pdf'
import type { Devis } from '@/lib/types/dossier'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
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
    .single()

  if (error || !devis) {
    return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (devis as any).organization_id)
    .single()

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
