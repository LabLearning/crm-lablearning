import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AttestationEntreePDF } from '@/lib/pdf/attestation-entree-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session')
  const poeiId = searchParams.get('poei')
  const candidatId = searchParams.get('candidat')

  const { data: apprenant } = await supabase.from('apprenants').select('*').eq('id', params.id).single()
  if (!apprenant) return NextResponse.json({ error: 'Apprenant introuvable' }, { status: 404 })

  let formation: any = null
  let dateDebut: string | null = null
  let dateFin: string | null = null
  let dureeHeures: number | null = null
  let lieu: string | null = null
  let formateurNom: string | null = null
  let poei: any = null

  if (poeiId) {
    const { data: p } = await supabase.from('poei').select('*').eq('id', poeiId).single()
    if (!p) return NextResponse.json({ error: 'Projet POEI introuvable' }, { status: 404 })
    dateDebut = p.date_debut
    dateFin = p.date_fin
    dureeHeures = p.duree_heures
    if (p.formation_id) {
      const { data: f } = await supabase.from('formations').select('*').eq('id', p.formation_id).single()
      formation = f
    }
    // Infos spécifiques au candidat (identifiant FT, poste) si fourni
    let identifiantFt = p.candidat_identifiant_ft || null
    let posteVise = p.poste_vise || null
    if (candidatId) {
      const { data: c } = await supabase.from('poei_candidats').select('identifiant_ft, poste_vise').eq('id', candidatId).single()
      if (c) { identifiantFt = c.identifiant_ft || identifiantFt; posteVise = c.poste_vise || posteVise }
    }
    let employeur: string | null = null
    if (p.client_id) {
      const { data: cl } = await supabase.from('clients').select('raison_sociale').eq('id', p.client_id).single()
      employeur = cl?.raison_sociale || null
    }
    poei = { identifiant_ft: identifiantFt, poste_vise: posteVise, employeur }
  } else if (sessionId) {
    const { data: s } = await supabase.from('sessions').select('*, formateur:formateurs(prenom, nom)').eq('id', sessionId).single()
    if (!s) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    dateDebut = s.date_debut
    dateFin = s.date_fin
    lieu = s.lieu
    formateurNom = s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : null
    if (s.formation_id) {
      const { data: f } = await supabase.from('formations').select('*').eq('id', s.formation_id).single()
      formation = f
    }
  } else {
    return NextResponse.json({ error: 'Contexte requis (session ou poei)' }, { status: 400 })
  }

  if (!formation) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', apprenant.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(
    createElement(AttestationEntreePDF, { apprenant, formation, org, dateDebut, dateFin, dureeHeures, lieu, formateurNom, poei }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attestation-entree-${apprenant.nom}-${apprenant.prenom || ''}.pdf"`,
    },
  })
}
