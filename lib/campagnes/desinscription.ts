import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { SITE_PUBLIC, URL_CRM } from './config'
import type { CanalCampagne } from './regles'

/**
 * Lien de désinscription d'un destinataire : jeton chiffré (AES-256-GCM) qui
 * porte l'organisme, le canal et l'adresse (ou les 9 derniers chiffres du
 * téléphone). Opaque : l'adresse ne se lit pas dans le lien (journaux,
 * mesure d'audience, historique du navigateur), et le chiffrement authentifié
 * empêche de le fabriquer. Il ne périme pas : un message reçu il y a un an doit
 * encore permettre de ne plus rien recevoir.
 *
 * Clé dédiée et stable, CAMPAGNES_SECRET (aucun envoi sans elle, voir
 * config.ts). Pour en changer sans casser les liens déjà envoyés, garder les
 * anciennes dans CAMPAGNES_SECRETS_ANCIENS (séparées par des virgules) : elles
 * servent encore à lire. Module serveur.
 */
const cle = (secret: string) => createHash('sha256').update(`campagnes-desinscription:${secret}`).digest()
const secretCourant = () => process.env.CAMPAGNES_SECRET || ''
const secretsDeLecture = () => [secretCourant(), ...String(process.env.CAMPAGNES_SECRETS_ANCIENS || '').split(',')]
  .map((s) => s.trim()).filter(Boolean)

/** campagneId : la campagne d'où vient le lien, pour compter ses désinscriptions */
export interface CibleDesinscription { orgId: string; canal: CanalCampagne; valeur: string; campagneId?: string | null }

export function jetonDesinscription(c: CibleDesinscription): string {
  const secret = secretCourant()
  if (!secret) throw new Error('CAMPAGNES_SECRET manquant : aucun lien de désinscription ne peut être fabriqué')
  const iv = randomBytes(12)
  const chiffre = createCipheriv('aes-256-gcm', cle(secret), iv)
  const corps = Buffer.concat([chiffre.update(JSON.stringify([c.orgId, c.canal, c.valeur, c.campagneId || null]), 'utf8'), chiffre.final()])
  return Buffer.concat([iv, corps, chiffre.getAuthTag()]).toString('base64url')
}

export function lireJetonDesinscription(jeton: unknown): CibleDesinscription | null {
  const texte = String(jeton || '')
  if (!/^[A-Za-z0-9_-]{40,700}$/.test(texte)) return null
  const brut = Buffer.from(texte, 'base64url')
  if (brut.length < 12 + 16 + 10) return null
  const iv = brut.subarray(0, 12)
  const tag = brut.subarray(brut.length - 16)
  const corps = brut.subarray(12, brut.length - 16)
  for (const secret of secretsDeLecture()) {
    try {
      const dechiffre = createDecipheriv('aes-256-gcm', cle(secret), iv)
      dechiffre.setAuthTag(tag)
      const [orgId, canal, valeur, campagneId] = JSON.parse(Buffer.concat([dechiffre.update(corps), dechiffre.final()]).toString('utf8'))
      if (typeof orgId !== 'string' || (canal !== 'email' && canal !== 'sms') || typeof valeur !== 'string' || !valeur) return null
      return { orgId, canal, valeur, campagneId: typeof campagneId === 'string' ? campagneId : null }
    } catch { /* autre secret, ou jeton faux */ }
  }
  return null
}

/** Page de désinscription (site public) et adresse du désabonnement en un clic (en-tête List-Unsubscribe). */
export const lienDesinscription = (jeton: string) => `${SITE_PUBLIC}/desinscription/${jeton}`
export const lienDesabonnementUnClic = (jeton: string) => `${URL_CRM}/api/public/desinscription?j=${jeton}`
