import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ContratFormationPDF } from '@/lib/pdf/contrat-formation-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select('*')
    .eq('id', params.id).single()
  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  const { data: client } = dossier.client_id
    ? await supabase.from('clients').select('*').eq('id', dossier.client_id).single()
    : { data: null }
  const { data: formation } = dossier.formation_id
    ? await supabase.from('formations').select('*').eq('id', dossier.formation_id).single()
    : { data: null }
  const { data: session } = dossier.session_id
    ? await supabase.from('sessions').select('*, formateur:formateurs(prenom, nom, qualifications, diplomes, certifications)').eq('id', dossier.session_id).single()
    : { data: null }
  const { data: org } = await supabase.from('organizations').select('*').eq('id', dossier.organization_id).single()

  const buffer = await renderToBuffer(
    createElement(ContratFormationPDF, { dossier, client, formation, session, org, formateur: (session as any)?.formateur }) as any
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrat-formation-${dossier.numero || dossier.id}.pdf"`,
    },
  })
}
