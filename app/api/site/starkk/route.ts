import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { emettreHorodatage, ageHorodatage } from '@/lib/inscription-formateur-garde'
import { STARKK_SITE } from '@/lib/fonctionnalites'
import {
  CLE_GARDE_STARKK, LIMITES, MAX_TOKENS_REPONSE, MODELE_STARKK_SITE,
  consigneStarkk, controlerDebit, ipPropre, journaliserEchange,
} from '@/lib/starkk-site'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sansCache = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
const refus = (statut: number, message: string) => NextResponse.json({ error: message }, { status: statut, headers: sansCache })

/** La bulle demande un jeton à l'ouverture : il prouve que la discussion part d'une page servie par nous. */
export async function GET() {
  if (STARKK_SITE === 'coupe') return refus(404, 'Starkk n’est pas disponible.')
  return NextResponse.json({ jeton: emettreHorodatage(CLE_GARDE_STARKK) }, { headers: sansCache })
}

/**
 * Starkk répond à un visiteur du site, en continu (texte brut diffusé au fil de
 * l'eau). Aucun outil, aucun accès au CRM : le modèle ne reçoit que le contenu
 * du site (lib/starkk-site) et la discussion. Chaque échange est consigné.
 */
export async function POST(req: Request) {
  if (STARKK_SITE === 'coupe') return refus(404, 'Starkk n’est pas disponible.')
  const cle = process.env.ANTHROPIC_API_KEY
  if (!cle) return refus(503, 'Starkk est indisponible pour le moment. Écrivez-nous par le formulaire de contact.')

  const corps = await req.json().catch(() => null)
  const age = ageHorodatage(CLE_GARDE_STARKK, corps?.jeton)
  if (age === null) return refus(403, 'La discussion a expiré : fermez puis rouvrez la bulle.')
  if (age < 1200) return refus(429, 'Un instant, puis renvoyez votre message.')
  const discussion = String(corps?.discussion || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(discussion)) return refus(400, 'Discussion inconnue : rouvrez la bulle.')

  // La discussion : alternance visiteur / Starkk, bornée en nombre et en longueur
  const brut: any[] = Array.isArray(corps?.messages) ? corps.messages.slice(-(LIMITES.messagesParDiscussion * 2)) : []
  const messages = brut
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).trim().slice(0, m.role === 'user' ? LIMITES.caracteresParMessage : 4000) }))
  while (messages.length && messages[0].role !== 'user') messages.shift()
  // Deux messages de suite du même auteur sont fusionnés : l'API attend une alternance
  const fil: typeof messages = []
  for (const m of messages) {
    const dernier = fil[fil.length - 1]
    if (dernier && dernier.role === m.role) dernier.content = `${dernier.content}\n${m.content}`
    else fil.push({ ...m })
  }
  if (!fil.length || fil[fil.length - 1].role !== 'user') return refus(400, 'Écrivez votre question.')
  const question = fil[fil.length - 1].content

  const ip = ipPropre(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'))
  const supabase = await createServiceRoleClient()
  const bloque = await controlerDebit(supabase, ip, discussion)
  if (bloque) return refus(bloque.statut, bloque.message)

  let amont: Response
  try {
    amont = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELE_STARKK_SITE,
        max_tokens: MAX_TOKENS_REPONSE,
        stream: true,
        system: await consigneStarkk(),
        messages: fil,
      }),
    })
  } catch (e) {
    console.error('[starkk site] appel', e)
    return refus(502, 'Starkk ne répond pas pour le moment. Réessayez dans un instant.')
  }
  if (!amont.ok || !amont.body) {
    console.error('[starkk site] amont', amont.status, (await amont.text().catch(() => '')).slice(0, 300))
    return refus(502, 'Starkk ne répond pas pour le moment. Réessayez dans un instant.')
  }

  const page = typeof corps?.page === 'string' ? corps.page.slice(0, 200) : null
  const navigateur = (req.headers.get('user-agent') || '').slice(0, 300) || null
  const lecteur = amont.body.getReader()
  const decodeur = new TextDecoder()
  const encodeur = new TextEncoder()
  let reponse = ''
  let arret: string | null = null
  const consommation: Record<string, number> = {}

  const flux = new ReadableStream<Uint8Array>({
    async start(sortie) {
      let tampon = ''
      // Le flux d'Anthropic arrive en événements « data: {json} » séparés par des lignes
      const traiter = (ligne: string) => {
        if (!ligne.startsWith('data:')) return
        let ev: any
        try { ev = JSON.parse(ligne.slice(5).trim()) } catch { return }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') {
          reponse += ev.delta.text
          sortie.enqueue(encodeur.encode(ev.delta.text))
        } else if (ev.type === 'message_start' && ev.message?.usage) {
          Object.assign(consommation, ev.message.usage)
        } else if (ev.type === 'message_delta') {
          if (ev.delta?.stop_reason) arret = ev.delta.stop_reason
          if (ev.usage) Object.assign(consommation, ev.usage)
        } else if (ev.type === 'error') {
          arret = 'erreur'
          console.error('[starkk site] flux', JSON.stringify(ev.error || ev).slice(0, 300))
        }
      }
      try {
        for (;;) {
          const { done, value } = await lecteur.read()
          if (done) break
          tampon += decodeur.decode(value, { stream: true })
          const lignes = tampon.split('\n')
          tampon = lignes.pop() || ''
          for (const l of lignes) traiter(l.trim())
        }
        if (tampon.trim()) traiter(tampon.trim())
      } catch (e) {
        arret = 'interrompu'
        console.error('[starkk site] lecture', e)
      }
      // Rien n'a été écrit (refus du modèle, erreur) : une phrase de repli plutôt qu'une bulle vide
      if (!reponse.trim()) {
        reponse = 'Je ne peux pas répondre à cette demande. Pour toute question sur nos formations, écrivez-nous par le [formulaire de contact](/contact).'
        sortie.enqueue(encodeur.encode(reponse))
      }
      const chiffres = Object.fromEntries(Object.entries(consommation).filter(([, v]) => typeof v === 'number')) as Record<string, number>
      await journaliserEchange(supabase, { discussion, ip, navigateur, page, question, reponse, arret, consommation: Object.keys(chiffres).length ? chiffres : null })
      sortie.close()
    },
    cancel() { lecteur.cancel().catch(() => {}) },
  })

  return new Response(flux, { headers: { ...sansCache, 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' } })
}
