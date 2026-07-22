import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { ConventionPDF } from '@/lib/pdf/convention-pdf'

const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

// Aperçu de la convention AVANT génération : rendu à partir de la session,
// sans rien écrire en base. Si une convention existe déjà, on rend celle-ci.
export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  // Contrôle d'org : la session doit appartenir à l'organisation de l'appelant.
  // On vérifie ici en amont pour couvrir les deux branches (convention existante
  // ou projection depuis la session).
  const { data: sessionOrg } = await supabase
    .from('sessions').select('id')
    .eq('id', params.sessionId).eq('organization_id', auth.user.organizationId)
    .maybeSingle()
  if (!sessionOrg) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  // Convention déjà créée ? → on rend la vraie
  const { data: existing } = await supabase
    .from('conventions').select('id').eq('session_id', params.sessionId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing?.id) {
    const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
    const loaded = await loadConventionForPdf(supabase, existing.id)
    if (loaded) {
      const buffer = await renderToBuffer(createElement(ConventionPDF, { convention: loaded.convention, org: loaded.org }) as any)
      return new NextResponse(new Uint8Array(buffer), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="convention-apercu.pdf"', 'Cache-Control': 'private, max-age=0' },
      })
    }
  }

  // Sinon : projection depuis la session (mêmes règles que la création)
  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(*), client:client_id(*)')
    .eq('id', params.sessionId).single()
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { count: nbApprenants } = await supabase
    .from('inscriptions').select('*', { count: 'exact', head: true })
    .eq('session_id', params.sessionId).not('status', 'in', '("annule","abandonne")')

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(civilite, nom, prenom)')
    .eq('session_id', params.sessionId).not('status', 'in', '("annule","abandonne")')

  const formation: any = (sess as any).formation
  const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
  const montantHt = tarifBase ? tarifBase * (nbApprenants || 1) : null

  const convention: any = {
    numero: 'APERÇU — non générée',
    type: sess.type_session === 'intra' ? 'intra_entreprise' : 'inter_entreprise',
    status: 'brouillon',
    objet: `Convention de formation — ${formation?.intitule || 'Formation'}`,
    nombre_stagiaires: nbApprenants || 0,
    duree_heures: formation?.duree_heures || null,
    lieu: sess.lieu || null,
    dates_formation: `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`,
    montant_ht: montantHt,
    taux_tva: 0,
    montant_ttc: montantHt,
    date_emission: new Date().toISOString(),
    client: (sess as any).client,
    formation,
    session: sess,
    participants: (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean),
    dossier: null,
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(createElement(ConventionPDF, { convention, org }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="convention-apercu.pdf"', 'Cache-Control': 'private, max-age=0' },
  })
}
