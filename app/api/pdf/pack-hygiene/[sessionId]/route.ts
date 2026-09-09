import { NextRequest, NextResponse } from 'next/server'
import { zipSync } from 'fflate'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { BUCKET_PACK_HYGIENE, PIECES, personnaliserPms, construireClasseur, type PieceClasseur, type PieceId } from '@/lib/pdf/pack-hygiene'
import { GET as reglementGET } from '../../reglement-interieur/route'
import { GET as programmeGET } from '../../programme/[id]/route'
import { GET as emargementGET } from '../../emargement/[id]/route'
import { GET as attestationsHygieneGET } from '../../attestation-hygiene/route'
import { GET as diplomeGET } from '../../diplome-etablissement/[id]/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Pack Hygiène d'une session : le classeur que le formateur apporte dans
 * l'établissement (PMS personnalisé, affichages obligatoires, livret
 * d'accueil, règlement intérieur, programme, feuilles d'émargement) et les
 * pièces remises en fin de formation (attestations d'hygiène, diplôme).
 *
 * GET /api/pdf/pack-hygiene/<sessionId>?doc=<pièce>
 *   doc = pms | affichages | livret | reglement | programme | emargement
 *       | attestations | diplome | classeur (PDF unique) | zip (défaut)
 *
 * Gabarits : ceux de la franchise de l'établissement (PMS co-brandé,
 * affichages, livret) sinon ceux de l'organisme. Un PMS propre à la
 * franchise (pms_personnalisable = false) est joint tel quel.
 */

const safeName = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'document'
const frDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

async function lireStorage(supabase: any, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(BUCKET_PACK_HYGIENE).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

async function lireUrl(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return new Uint8Array(await r.arrayBuffer())
  } catch { return null }
}

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const supabase = await createServiceRoleClient()
  const orgId = auth.user.organizationId
  const doc = (req.nextUrl.searchParams.get('doc') || 'zip') as PieceId | 'classeur' | 'zip'

  const { data: sess } = await supabase
    .from('sessions')
    .select('id, reference, date_debut, date_fin, formation_id, client_id, horaires_jours, formation:formation_id(intitule, duree_heures), client:client_id(*), formateur:formateur_id(prenom, nom)')
    .eq('id', params.sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  const client: any = (sess as any).client
  if (!client) return NextResponse.json({ error: 'Aucun établissement rattaché à la session' }, { status: 400 })
  const formation: any = (sess as any).formation

  const [{ data: org }, { data: franchise }, { data: inscriptions }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    client.franchise_id
      ? supabase.from('franchises').select('*').eq('id', client.franchise_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('inscriptions')
      .select('apprenant:apprenants(id, civilite, prenom, nom, poste)')
      .eq('session_id', params.sessionId).not('status', 'in', '("annule","abandonne")'),
  ])
  const etablissement: string = client.nom_commercial || client.raison_sociale || 'Établissement'
  const nomOrg: string = org?.name || 'Lab Learning'

  // ── Gabarits : franchise, sinon organisme ──
  const gabaritPms: { path: string | null; personnalisable: boolean } = franchise?.pms_path
    ? { path: franchise.pms_path, personnalisable: franchise.pms_personnalisable !== false }
    : { path: org?.pms_path || null, personnalisable: true }
  const gabaritAffichages: string | null = franchise?.affichages_path || org?.affichages_path || null
  const livret: { path?: string; url?: string } | null = franchise?.livret_path
    ? { path: franchise.livret_path }
    : org?.livret_accueil_url ? { url: org.livret_accueil_url } : null

  // ── Producteurs de chaque pièce ──
  const appelerRoute = async (handler: (req: any, ctx?: any) => Promise<Response>, path: string, id?: string): Promise<Uint8Array | null> => {
    try {
      const r = await handler(new NextRequest(`${req.nextUrl.origin}${path}`), id ? { params: { id } } : undefined)
      if (!r.ok || !(r.headers.get('content-type') || '').includes('pdf')) return null
      return new Uint8Array(await r.arrayBuffer())
    } catch { return null }
  }

  const produirePms = async (): Promise<Uint8Array | null> => {
    if (!gabaritPms.path) return null
    const bytes = await lireStorage(supabase, gabaritPms.path)
    if (!bytes) return null
    if (!gabaritPms.personnalisable) return bytes
    const { loadSignataireContact } = await import('@/lib/pdf/convention-data')
    const signataire: any = await loadSignataireContact(supabase, client.id, null).catch(() => null)
    const responsableNom = signataire ? [signataire.prenom, signataire.nom].filter(Boolean).join(' ') || null : null
    const formes = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean).map((a: any) => ({
      nom: [a.prenom, a.nom].filter(Boolean).join(' '),
      fonction: a.poste || null,
    }))
    const nbJours = Array.isArray(sess.horaires_jours) && sess.horaires_jours.length ? sess.horaires_jours.length : null
    const duree = formation?.duree_heures ? `${formation.duree_heures} h${nbJours && nbJours > 1 ? ` sur ${nbJours} jours` : ''}` : ''
    const dates = sess.date_debut === sess.date_fin || !sess.date_fin
      ? `Le ${frDate(sess.date_debut)}`
      : `Du ${frDate(sess.date_debut)} au ${frDate(sess.date_fin)}`
    return personnaliserPms(bytes, {
      etablissement,
      dateMaj: new Date(sess.date_fin || sess.date_debut || Date.now()),
      responsableNom,
      responsableQualite: signataire?.poste || signataire?.fonction || (responsableNom ? 'Dirigeant' : null),
      ville: client.ville || null,
      siret: client.siret ? String(client.siret).replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : null,
      repasParJour: client.repas_par_jour ?? null,
      referentHaccp: client.referent_haccp || null,
      exploitant: client.raison_sociale || etablissement,
      adresse: client.adresse || null,
      codePostalVille: [client.code_postal, client.ville].filter(Boolean).join(' ') || null,
      activite: client.secteur_activite || null,
      formes,
      formationIntitule: formation?.intitule || sess.reference || 'Formation hygiène alimentaire',
      formationDates: dates,
      formationDuree: duree,
      organisme: `${nomOrg} (organisme certifié Qualiopi)`,
    })
  }

  const producteurs: Record<PieceId, () => Promise<Uint8Array | null>> = {
    pms: produirePms,
    affichages: async () => (gabaritAffichages ? lireStorage(supabase, gabaritAffichages) : null),
    livret: async () => (livret?.path ? lireStorage(supabase, livret.path) : livret?.url ? lireUrl(livret.url) : null),
    reglement: () => appelerRoute(reglementGET as any, '/api/pdf/reglement-interieur'),
    programme: () => (sess.formation_id ? appelerRoute(programmeGET as any, `/api/pdf/programme/${sess.formation_id}?session=${sess.id}`, sess.formation_id) : Promise.resolve(null)),
    emargement: () => appelerRoute(emargementGET as any, `/api/pdf/emargement/${sess.id}`, sess.id),
    attestations: () => appelerRoute(attestationsHygieneGET as any, `/api/pdf/attestation-hygiene?session=${sess.id}`),
    diplome: () => appelerRoute(diplomeGET as any, `/api/pdf/diplome-etablissement/${sess.id}`, sess.id),
  }

  const pdfResponse = (bytes: Uint8Array, nom: string, inline = true) => new NextResponse(bytes as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName(nom)}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })

  // ── Une pièce seule ──
  if (doc !== 'zip' && doc !== 'classeur') {
    const piece = PIECES.find((p) => p.id === doc)
    if (!piece) return NextResponse.json({ error: 'Pièce inconnue' }, { status: 400 })
    const bytes = await producteurs[piece.id]()
    if (!bytes) return NextResponse.json({ error: `${piece.titre} : indisponible (gabarit manquant ou données insuffisantes)` }, { status: 404 })
    return pdfResponse(bytes, `${piece.titre} - ${etablissement}`)
  }

  // ── Tout : on produit chaque pièce (en parallèle), on ignore celles qui manquent ──
  const resultats = await Promise.all(PIECES.map(async (p) => ({ piece: p, bytes: await producteurs[p.id]() })))
  const presentes = resultats.filter((r): r is { piece: typeof PIECES[number]; bytes: Uint8Array } => !!r.bytes)
  if (!presentes.length) return NextResponse.json({ error: 'Aucune pièce disponible' }, { status: 404 })

  const sousTitre = `${formation?.intitule || 'Formation hygiène alimentaire'} · ${sess.date_debut === sess.date_fin || !sess.date_fin ? `le ${frDate(sess.date_debut)}` : `du ${frDate(sess.date_debut)} au ${frDate(sess.date_fin)}`}${(sess as any).formateur ? ` · Formateur : ${(sess as any).formateur.prenom || ''} ${(sess as any).formateur.nom || ''}`.trimEnd() : ''}`

  if (doc === 'classeur') {
    const pieces: PieceClasseur[] = presentes.map((r) => ({ titre: r.piece.titre, sousTitre: r.piece.sousTitre, bytes: r.bytes }))
    const classeur = await construireClasseur({ titre: 'Pack Hygiène', etablissement, sousTitre, organisme: nomOrg, pieces })
    return pdfResponse(classeur, `Pack Hygiene - ${etablissement}`, false)
  }

  const files: Record<string, Uint8Array> = {}
  presentes.forEach((r, i) => {
    const dossier = r.piece.bloc === 'apporter' ? '1 - A apporter' : '2 - A remettre en fin de formation'
    files[`${dossier}/${String(i + 1).padStart(2, '0')} - ${safeName(r.piece.titre)}.pdf`] = r.bytes
  })
  const zipped = zipSync(files, { level: 0 })
  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName(`Pack Hygiene - ${etablissement}`)}.zip"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
