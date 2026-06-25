import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { PdcPDF } from '@/lib/pdf/pdc-pdf'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  // Candidat POEI (+ apprenant)
  const { data: candidat } = await supabase
    .from('poei_candidats')
    .select('*, apprenant:apprenants(civilite, nom, prenom, email, telephone)')
    .eq('id', params.id)
    .single()
  if (!candidat) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })

  // Projet POEI
  const { data: poei } = await supabase
    .from('poei')
    .select('*')
    .eq('id', candidat.poei_id)
    .single()

  const [{ data: client }, { data: formation }, { data: session }, { data: org }] = await Promise.all([
    poei?.client_id ? supabase.from('clients').select('*').eq('id', poei.client_id).single() : Promise.resolve({ data: null }),
    poei?.formation_id ? supabase.from('formations').select('intitule, programme_detaille, competences_visees, objectifs_pedagogiques, duree_heures').eq('id', poei.formation_id).single() : Promise.resolve({ data: null }),
    poei?.session_id ? supabase.from('sessions').select('date_debut, date_fin, horaires_jours, lieu').eq('id', poei.session_id).single() : Promise.resolve({ data: null }),
    supabase.from('organizations').select('name, siret').eq('id', candidat.organization_id).single(),
  ])

  const buffer = await renderToBuffer(
    createElement(PdcPDF, { candidat, poei, client, formation, session, org }) as any
  )

  const nom = `${candidat.apprenant?.prenom || ''}_${candidat.apprenant?.nom || 'candidat'}`.replace(/\s+/g, '')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="plan-developpement-competences-${nom}.pdf"`,
    },
  })
}
