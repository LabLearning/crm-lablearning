import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { configCampagnes } from '@/lib/campagnes/config'
import { ajouterOpposition, type SourceOpposition } from '@/lib/campagnes/oppositions'
import { numeroSmsFrance } from '@/lib/campagnes/regles'
import { recompter } from '@/lib/campagnes/envoi'

export const dynamic = 'force-dynamic'

/**
 * Webhook Brevo (e-mails et SMS des campagnes) : désinscriptions, rebonds
 * définitifs, plaintes et STOP deviennent des oppositions ; l'envoi concerné
 * passe en échec s'il n'est jamais arrivé. Adresse à déclarer chez Brevo :
 * /api/webhooks/brevo?cle=<BREVO_WEBHOOK_SECRET> (Brevo ne signe pas ses
 * appels : la clé de l'adresse fait foi).
 */
const EVENEMENTS_EMAIL: Record<string, SourceOpposition> = {
  unsubscribed: 'lien_desinscription',
  hard_bounce: 'rebond',
  invalid_email: 'rebond',
  blocked: 'rebond',
  spam: 'plainte',
}

const empreinte = (v: string) => createHash('sha256').update(`brevo:${v}`).digest()

export async function POST(req: Request) {
  const { secretWebhook } = configCampagnes()
  const cle = new URL(req.url).searchParams.get('cle') || ''
  if (!secretWebhook || !cle || !timingSafeEqual(empreinte(cle), empreinte(secretWebhook))) {
    return NextResponse.json({ message: 'Clé inconnue' }, { status: 401 })
  }
  const brut = await req.text()
  if (brut.length > 200_000) return NextResponse.json({ message: 'Envoi trop volumineux' }, { status: 413 })
  let corps: any
  try { corps = JSON.parse(brut) } catch { return NextResponse.json({ message: 'Corps illisible' }, { status: 400 }) }
  const evenements: any[] = Array.isArray(corps) ? corps.slice(0, 500) : [corps]

  const supabase = await createServiceRoleClient()
  for (const ev of evenements) {
    try {
      const nom = String(ev?.event || ev?.msg_status || '').toLowerCase()
      const messageId = String(ev?.['message-id'] || ev?.messageId || ev?.message_id || '').replace(/[<>]/g, '')
      // L'envoi d'origine dit l'organisme ; sans lui, l'événement ne concerne pas une campagne du CRM
      let { data: envoi } = messageId
        ? await supabase.from('campagne_envois').select('id, organization_id, campagne_id, destination').eq('message_id', messageId).maybeSingle()
        : { data: null as any }
      // Un STOP reçu en réponse ne porte pas toujours l'identifiant du SMS : on le rattache au dernier SMS envoyé à ce numéro
      if (!envoi && /unsubscribe/.test(nom)) {
        const numero = numeroSmsFrance(String(ev?.to || ev?.from || ev?.number || ''))
        if (numero) {
          // Un SMS parti d'abord, sinon un SMS peut-être parti (délai dépassé, passage coupé : sans identifiant) ;
          // jamais une ligne en attente ou écartée, qui n'a pas pu recevoir de réponse
          const dernier = (statuts: string[]) => supabase.from('campagne_envois').select('id, organization_id, campagne_id, destination')
            .eq('destination', numero).in('statut', statuts).not('envoye_le', 'is', null)
            .order('envoye_le', { ascending: false, nullsFirst: false }).limit(1)
          const { data: parti } = await dernier(['envoye'])
          envoi = parti?.[0] || (await dernier(['echec', 'en_cours'])).data?.[0] || null
        }
      }
      if (!envoi) continue
      const sms = /^\d+$/.test(String(envoi.destination))
      const source: SourceOpposition | undefined = sms
        ? (/unsubscribe/.test(nom) ? 'stop_sms' : nom === 'hard_bounce' ? 'rebond' : undefined)
        : EVENEMENTS_EMAIL[nom]
      if (!source) continue
      const nouvelle = await ajouterOpposition(supabase, envoi.organization_id, sms ? 'sms' : 'email', envoi.destination, source, `Brevo : ${nom}`)
      if (source === 'rebond') {
        await supabase.from('campagne_envois').update({ statut: 'echec', erreur: `Non distribué (${nom})` }).eq('id', envoi.id)
        await recompter(supabase, envoi.campagne_id)
      }
      if (nouvelle && (source === 'lien_desinscription' || source === 'stop_sms')) {
        const { data: c } = await supabase.from('campagnes').select('nb_desinscrits').eq('id', envoi.campagne_id).maybeSingle()
        if (c) await supabase.from('campagnes').update({ nb_desinscrits: (c.nb_desinscrits || 0) + 1 }).eq('id', envoi.campagne_id)
      }
    } catch (e: any) {
      console.error('[brevo] événement', e?.message || e)
    }
  }
  return NextResponse.json({ ok: true })
}
