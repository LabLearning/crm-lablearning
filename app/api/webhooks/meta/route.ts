import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { canauxMetaActifs, decoderAvecIdentifiants, importerProspectMeta, noterEchecLecture, noterNotificationMeta, signatureValide } from '@/lib/prospects/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Webhook Meta : prospects des formulaires publicitaires (champ « leadgen »
 * de la Page). Public, sans session : l'authenticité vient de la signature
 * X-Hub-Signature-256 (clé secrète de l'app) et, pour la vérification de
 * l'abonnement, du jeton de vérification enregistré au branchement.
 */

/** Vérification de l'abonnement : Meta envoie hub.challenge, on le renvoie si le jeton est le nôtre. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const jeton = q.get('hub.verify_token') || ''
  const defi = q.get('hub.challenge') || ''
  if (q.get('hub.mode') !== 'subscribe' || !jeton || !defi) {
    return new NextResponse('Requête inattendue', { status: 400 })
  }
  const supabase = await createServiceRoleClient()
  const { data } = await supabase.from('canaux_prospects').select('organization_id')
    .eq('canal', 'meta').eq('cle_verification', jeton).limit(1)
  if (!data?.length) return new NextResponse('Jeton de vérification inconnu', { status: 403 })
  return new NextResponse(defi, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

/** Au-delà, ce n'est pas une notification de prospect (quelques ko d'ordinaire) */
const TAILLE_MAX = 256_000

/**
 * Notification d'un nouveau prospect. Répond toujours 200 une fois la
 * signature vérifiée : une réception en échec reste au journal et le relevé
 * toutes les 10 minutes la reprend. Des refus répétés amèneraient Meta à
 * couper l'abonnement de l'app.
 * Dans l'ordre, pour qu'un envoi anonyme coûte le moins possible : forme de
 * l'en-tête de signature, taille, signature (base lue seulement ici), puis
 * décodage du corps.
 */
export async function POST(req: Request) {
  const signature = req.headers.get('x-hub-signature-256') || ''
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) return new NextResponse('Signature absente', { status: 401 })
  const annonce = Number(req.headers.get('content-length') || 0)
  if (annonce > TAILLE_MAX) return new NextResponse('Envoi trop volumineux', { status: 413 })
  const brut = await req.text()
  if (brut.length > TAILLE_MAX) return new NextResponse('Envoi trop volumineux', { status: 413 })

  const supabase = await createServiceRoleClient()
  const canaux = (await canauxMetaActifs(supabase)).filter((c) => c.secrets?.app_secret)
  const signes = canaux.filter((c) => signatureValide(brut, signature, c.secrets!.app_secret))
  if (!signes.length) return new NextResponse('Signature invalide', { status: 401 })

  let corps: any
  // Identifiants gardés en texte : décodés en nombres, ils seraient arrondis au-delà de 16 chiffres
  try { corps = decoderAvecIdentifiants(brut) } catch { return new NextResponse('Corps illisible', { status: 400 }) }
  if (corps?.object !== 'page') return NextResponse.json({ ok: true })

  const prospects: { pageId: string; leadgenId: string; formId: string | null; adId: string | null; createdTime: string | null }[] = []
  for (const entree of (corps.entry || []) as any[]) {
    for (const ch of (entree.changes || []) as any[]) {
      if (ch?.field !== 'leadgen') continue
      const leadgenId = String(ch.value?.leadgen_id || '')
      if (!/^\d{5,25}$/.test(leadgenId)) continue
      prospects.push({
        pageId: String(ch.value?.page_id || entree.id || ''), leadgenId,
        formId: ch.value?.form_id ? String(ch.value.form_id) : null, adId: ch.value?.ad_id ? String(ch.value.ad_id) : null,
        createdTime: ch.value?.created_time ? String(ch.value.created_time) : null,
      })
    }
  }

  let recus = 0
  for (const p of prospects) {
    // La Page doit être celle d'un canal dont la clé a signé la notification
    const canal = signes.find((c) => c.config?.page_id === p.pageId)
    if (!canal) { console.warn('[webhook meta] page inconnue', p.pageId); continue }
    // Au journal d'abord : une lecture qui échoue ne perd pas l'identifiant du prospect
    await noterNotificationMeta(supabase, canal.organization_id, { leadgenId: p.leadgenId, pageId: p.pageId, formId: p.formId, adId: p.adId, createdTime: p.createdTime })
    try {
      const r = await importerProspectMeta(supabase, canal, p.leadgenId)
      if (r.statut !== 'erreur') recus++
    } catch (e: any) {
      console.error('[webhook meta] prospect', p.leadgenId, e?.message || e)
      await noterEchecLecture(supabase, canal.organization_id, p.leadgenId, String(e?.message || e))
      await supabase.from('canaux_prospects').update({
        derniere_erreur: String(e?.message || e).slice(0, 500), derniere_erreur_at: new Date().toISOString(),
      }).eq('organization_id', canal.organization_id).eq('canal', 'meta')
    }
  }
  return NextResponse.json({ ok: true, recus })
}
