/**
 * Horodatage signé du formulaire public d'inscription des formateurs.
 * La page (rendu serveur) émet « <ms>.<signature> » ; les actions vérifient
 * que la page a bien été servie par nous, il y a plus de quelques secondes et
 * moins d'un jour. L'horloge du navigateur n'intervient pas.
 * Module serveur uniquement (crypto de Node, secret d'environnement).
 */
import { createHmac, timingSafeEqual } from 'crypto'

const secret = () => process.env.INSCRIPTION_FORMATEUR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const signer = (token: string, ms: number) => createHmac('sha256', secret()).update(`inscription-formateur.${token}.${ms}`).digest('hex').slice(0, 40)

export function emettreHorodatage(token: string, ms: number = Date.now()): string {
  return `${ms}.${signer(token, ms)}`
}

/** Âge en millisecondes de la page qui a émis le jeton ; null si le jeton est faux ou périmé (plus de 24 h). */
export function ageHorodatage(token: string, jeton: unknown): number | null {
  const m = /^(\d{13})\.([a-f0-9]{40})$/.exec(String(jeton || ''))
  if (!m || !secret()) return null
  const ms = Number(m[1])
  const attendu = Buffer.from(signer(token, ms))
  const recu = Buffer.from(m[2])
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null
  const age = Date.now() - ms
  return age >= 0 && age <= 24 * 3600 * 1000 ? age : null
}
