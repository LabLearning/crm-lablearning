import { NextResponse } from 'next/server'
import {
  verifierSante, envoyerAlerte, messagePanne, messageRetabli, clePanne, lireBattement, ecrireBattement,
  historiserPanne, alerteEnvoyeeDepuis, type EtatSante,
} from '@/lib/sante'

export const dynamic = 'force-dynamic'
// Pire cas : 3 sondages de 8 s, 2 pauses de 15 s, puis battement et envoi
export const maxDuration = 120

/** Plus de 3 min 30 entre deux réussites : au moins un passage a échoué ou manqué. */
const TROU_MAX_MS = 3.5 * 60 * 1000
/** Sans témoin Resend lisible, seul un trou de plusieurs passages compte comme panne. */
const TROU_SUR_MS = 5.5 * 60 * 1000

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Surveillance du CRM, toutes les 2 minutes (Vercel Cron).
 *
 * Panne : trois échecs de suite sur 30 à 55 secondes (un raté isolé n'alerte
 * pas), puis un e-mail, et un rappel par demi-heure tant qu'elle dure.
 * Enregistrement : chaque passage réussi écrit son battement en base
 * (sante_plateforme) ; une écriture impossible alors que la lecture marche
 * (base en lecture seule, disque plein) est une panne.
 * Retour : un battement ancien signale des passages en échec ; si une alerte
 * est bien partie entre-temps (témoin : les e-mails envoyés par Resend), le
 * message « le CRM répond de nouveau » part avant que le battement n'avance,
 * et il est réessayé tant que Resend ne l'a pas pris.
 *
 * ?essai=panne (avec le secret) envoie une alerte d'essai sans rien casser.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const debutPassage = new Date()

  if (new URL(req.url).searchParams.get('essai') === 'panne') {
    const etat = await verifierSante()
    const envoi = await envoyerAlerte(messagePanne(etat, { essai: true }), `crm-essai-${debutPassage.toISOString().slice(0, 16)}`)
    return NextResponse.json({ essai: true, etat, envoi })
  }

  let etat: EtatSante = await verifierSante()
  for (const attente of [15000, 15000]) {
    if (etat.ok) break
    await pause(attente)
    etat = await verifierSante()
  }

  if (!etat.ok) {
    // Base lisible (panne de la connexion ou du stockage) : on date la panne
    const battement = etat.services.base.ok ? await lireBattement() : null
    return alerter(etat, battement?.dernierOk || null)
  }

  const battement = await lireBattement()
  // Migration 163 pas encore appliquée : l'alerte de panne marche, pas le suivi du retour
  if (battement.tableAbsente) return NextResponse.json({ ok: true, etat, suivi: 'table sante_plateforme absente (migration 163)' })
  if (!battement.ok) return NextResponse.json({ ok: true, etat, suivi: `lecture du battement : ${battement.erreur}` })

  // Retour après une panne : prévenir avant d'avancer le battement, pour réessayer si l'envoi échoue
  let retour: any = null
  const precedent = battement.dernierOk
  if (precedent && debutPassage.getTime() - precedent.getTime() > TROU_MAX_MS) {
    const trou = debutPassage.getTime() - precedent.getTime()
    const alerte = await alerteEnvoyeeDepuis(precedent)
    const panne = alerte === true || (alerte === null && trou > TROU_SUR_MS)
    retour = { trou_minutes: Math.round(trou / 60000), alerte_envoyee: alerte, panne }
    if (panne) {
      await historiserPanne(precedent, debutPassage)
      const envoi = await envoyerAlerte(messageRetabli(precedent, debutPassage), `crm-retabli-${precedent.toISOString()}`)
      retour.message = envoi
      if (envoi.reessayer) return NextResponse.json({ ok: true, etat, retour, suivi: 'message de retour à réessayer' })
    }
  }

  // Le battement est aussi la sonde d'écriture : un second essai avant de conclure
  let ecriture = await ecrireBattement(debutPassage)
  if (!ecriture.ok) {
    await pause(10000)
    ecriture = await ecrireBattement(debutPassage)
  }
  if (!ecriture.ok) {
    const lectureSeule: EtatSante = { ...etat, ok: false, services: { ...etat.services, ecriture } }
    return alerter(lectureSeule, precedent)
  }
  return NextResponse.json({ ok: true, etat, retour })
}

async function alerter(etat: EtatSante, dernierOk: Date | null) {
  const envoi = await envoyerAlerte(messagePanne(etat, { dernierOk }), clePanne(etat))
  console.error('[sante] CRM en panne', JSON.stringify(etat.services), envoi.detail)
  return NextResponse.json({ ok: false, etat, alerte: envoi })
}
