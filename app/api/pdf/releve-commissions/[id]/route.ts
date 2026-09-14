import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { getFranchiseCommissionLines } from '@/lib/franchise-data'
import { syncFranchiseCommissions } from '@/lib/commission'
import { ReleveCommissionsPDF, type LigneReleve } from '@/lib/pdf/releve-commissions-pdf'

/** Rôles internes autorisés à éditer le relevé d'une franchise du CRM. */
const ROLES_INTERNES = ['super_admin', 'admin', 'gestionnaire', 'comptable']

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Relevé des commissions dues à une franchise, dossier par dossier.
 * Par défaut les commissions validées (ce qui est à verser) ; `?etat=payee`
 * réédite un relevé déjà réglé, `?etat=a_venir` le prévisionnel.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  const { data: franchise } = await supabase
    .from('franchises').select('*')
    .eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!franchise) return NextResponse.json({ error: 'Franchise introuvable' }, { status: 404 })

  // Un compte franchise ne lit que le relevé de son propre réseau.
  if (auth.user.role === 'franchise') {
    const { data: u } = await supabase.from('users').select('franchise_id').eq('id', auth.user.id).single()
    if (u?.franchise_id !== params.id) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  } else if (!ROLES_INTERNES.includes(auth.user.role)) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const etat = new URL(req.url).searchParams.get('etat') || 'validee'
  if (!['validee', 'payee', 'a_venir'].includes(etat)) {
    return NextResponse.json({ error: 'État inconnu' }, { status: 400 })
  }

  await syncFranchiseCommissions(supabase, params.id, auth.user.organizationId)
  const toutes = await getFranchiseCommissionLines(supabase, params.id, auth.user.organizationId)
  const retenues = toutes.filter((l) => l.status === etat && Number(l.commission_montant || 0) > 0)
  if (!retenues.length) {
    return NextResponse.json({ error: 'Aucune commission à relever pour cet état' }, { status: 404 })
  }

  // Stagiaires par session, pour justifier chaque dossier
  const sessionIds = retenues.map((l) => l.session_id)
  const inscrits = new Map<string, number>()
  for (let i = 0; i < sessionIds.length; i += 100) {
    const { data } = await supabase.from('inscriptions').select('session_id')
      .in('session_id', sessionIds.slice(i, i + 100)).not('status', 'in', '("annule","abandonne")')
    for (const r of (data || []) as any[]) inscrits.set(r.session_id, (inscrits.get(r.session_id) || 0) + 1)
  }

  const lignes: LigneReleve[] = retenues.map((l) => ({
    etablissement: l.client?.raison_sociale || 'Établissement',
    ville: (l.client as any)?.ville || null,
    formation: l.session?.formation?.intitule || l.session?.intitule || 'Formation',
    reference: l.session?.reference || null,
    dateDebut: l.session?.date_debut || null,
    dateFin: l.session?.date_fin || null,
    nbStagiaires: inscrits.get(l.session_id) || 0,
    base: Number(l.base_montant || 0),
    coutFormateur: Number(l.cout_formateur || 0),
    commission: Number(l.commission_montant || 0),
  }))

  const aVenir = toutes.filter((l) => l.status === 'a_venir' && Number(l.commission_montant || 0) > 0)
  const enCours = etat === 'validee'
    ? { nombre: aVenir.length, montant: aVenir.reduce((t, l) => t + Number(l.commission_montant || 0), 0) }
    : { nombre: 0, montant: 0 }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', auth.user.organizationId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const d = new Date()
  const numero = `COM-${slug(franchise.nom || 'franchise').toUpperCase().slice(0, 12)}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

  const buffer = await renderToBuffer(
    createElement(ReleveCommissionsPDF, { org, franchise, lignes, numero, enCours }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="releve-commissions-${slug(franchise.nom || 'franchise')}-${d.toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
