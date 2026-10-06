/**
 * Accès aux modèles gratuits du site : horodatage du formulaire (anti-robots)
 * et lien de téléchargement signé, valable quelques jours, remis après la
 * demande. Module serveur uniquement (crypto de Node, secret d'environnement).
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { createElement } from 'react'
import { modeleParSlug } from '@/lib/modeles'

const secret = () => process.env.INSCRIPTION_FORMATEUR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const signer = (slug: string, expire: number) => createHmac('sha256', secret()).update(`modele-site.${slug}.${expire}`).digest('hex').slice(0, 40)

export const VALIDITE_LIEN_JOURS = 14

/** Jeton de téléchargement d'un modèle : « <expiration en ms>.<signature> ». */
export function signerTelechargement(slug: string, maintenant: number = Date.now()): string {
  const expire = maintenant + VALIDITE_LIEN_JOURS * 24 * 3600 * 1000
  return `${expire}.${signer(slug, expire)}`
}

export function telechargementValide(slug: string, jeton: unknown): boolean {
  const m = /^(\d{13})\.([a-f0-9]{40})$/.exec(String(jeton || ''))
  if (!m || !secret()) return false
  const expire = Number(m[1])
  const attendu = Buffer.from(signer(slug, expire))
  const recu = Buffer.from(m[2])
  return attendu.length === recu.length && timingSafeEqual(attendu, recu) && expire >= Date.now()
}

/** Le PDF d'un modèle, généré à la demande ; null si le modèle n'existe pas. */
export async function rendreModele(slug: string): Promise<Buffer | null> {
  if (!modeleParSlug(slug)) return null
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const pdf = await import('@/lib/pdf/modeles-pdf')
  const composant = {
    'tableau-allergenes-restaurant': pdf.TableauAllergenesPDF,
    'releve-temperatures-restaurant': pdf.ReleveTemperaturesPDF,
    'plan-nettoyage-desinfection-restaurant': pdf.PlanNettoyagePDF,
    'document-unique-duerp-restauration-rapide': pdf.TrameDuerpPDF,
  }[slug]
  if (!composant) return null
  return Buffer.from(await renderToBuffer(createElement(composant) as any))
}
