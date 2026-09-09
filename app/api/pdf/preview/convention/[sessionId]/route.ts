import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { ConventionPDF } from '@/lib/pdf/convention-pdf'

const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

// Aperçu de la convention AVANT génération : rendu à partir de la session,
// sans rien écrire en base. Si une convention existe déjà, on rend celle-ci.
//
// Session INTER : `?client=<id>` cible une entreprise précise (une convention
// par entreprise, couvrant ses seuls stagiaires, mêmes règles de montant que
// l'envoi réel). `?download=1` renvoie le PDF en pièce à télécharger.
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  const clientCible = req.nextUrl.searchParams.get('client')
  const download = req.nextUrl.searchParams.get('download') === '1'
  const disposition = (nom: string) => `${download ? 'attachment' : 'inline'}; filename="${nom}"`

  // Contrôle d'org : la session doit appartenir à l'organisation de l'appelant.
  // On vérifie ici en amont pour couvrir les deux branches (convention existante
  // ou projection depuis la session).
  const { data: sessionOrg } = await supabase
    .from('sessions').select('id')
    .eq('id', params.sessionId).eq('organization_id', auth.user.organizationId)
    .maybeSingle()
  if (!sessionOrg) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  // Convention déjà créée (pour ce client si précisé) ? → on rend la vraie
  let q = supabase.from('conventions').select('id').eq('session_id', params.sessionId)
  if (clientCible) q = q.eq('client_id', clientCible)
  const { data: existing } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing?.id) {
    const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
    const loaded = await loadConventionForPdf(supabase, existing.id)
    if (loaded) {
      const buffer = await renderToBuffer(createElement(ConventionPDF, { convention: loaded.convention, org: loaded.org }) as any)
      return new NextResponse(new Uint8Array(buffer), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disposition(`convention-${loaded.convention.numero || 'apercu'}.pdf`), 'Cache-Control': 'private, max-age=0' },
      })
    }
  }

  // Sinon : projection depuis la session (mêmes règles que la création)
  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(*), client:client_id(*)')
    .eq('id', params.sessionId).single()
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { data: inscriptionsToutes } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(id, civilite, nom, prenom, client_id)')
    .eq('session_id', params.sessionId).not('status', 'in', '("annule","abandonne")')
  let participants = (inscriptionsToutes || []).map((i: any) => i.apprenant).filter(Boolean)

  // Entreprise ciblée (session inter) : ses stagiaires et sa fiche client
  let client: any = (sess as any).client
  let clientId: string | null = sess.client_id
  if (clientCible) {
    const { data: cli } = await supabase.from('clients').select('*')
      .eq('id', clientCible).eq('organization_id', auth.user.organizationId).maybeSingle()
    if (!cli) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    client = cli
    clientId = cli.id
    participants = participants.filter((a: any) => a.client_id === clientCible)
  }
  const nbApprenants = participants.length

  const formation: any = (sess as any).formation
  // Le prix saisi sur la session fait foi pour le client de la session ; sinon
  // repli sur le tarif catalogue × stagiaires de l'entreprise (mêmes règles que
  // la création réelle de la convention).
  const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
  const prixSessionApplicable = (sess as any).prix_ht != null && (!clientCible || clientCible === sess.client_id)
  const montantHt = prixSessionApplicable
    ? Number((sess as any).prix_ht)
    : (tarifBase ? Number(tarifBase) * (nbApprenants || 1) : null)

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
    client,
    client_id: clientId,
    formation,
    session: sess,
    participants,
    dossier: null,
  }
  const { loadSignataireContact } = await import('@/lib/pdf/convention-data')
  convention.signataire_contact = await loadSignataireContact(supabase, clientId, null)

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(createElement(ConventionPDF, { convention, org }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disposition('convention-apercu.pdf'), 'Cache-Control': 'private, max-age=0' },
  })
}
