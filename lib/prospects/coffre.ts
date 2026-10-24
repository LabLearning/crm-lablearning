import { createHash } from 'crypto'
import { encryptSecret, decryptSecret, type EncryptedBlob } from '@/lib/secret-vault'

/**
 * Coffre des jetons des canaux publicitaires (Meta, Google Ads), rangés
 * chiffrés dans canaux_prospects.secrets.
 *
 * Trousseau, de la clé courante à la plus ancienne :
 *  1. PROSPECTS_SECRET_KEY, puis PROSPECTS_SECRET_KEY_PREVIOUS (liste séparée par des virgules) ;
 *  2. une clé dérivée d'OPCO_SECRET_KEY (et de ses précédentes), posée en production ;
 *  3. une clé dérivée de la clé de service Supabase (et de ses précédentes).
 * On chiffre avec la première ; on déchiffre avec celle dont l'identifiant est
 * inscrit dans le blob. Les dérivées portent le préfixe « prospects: » : elles
 * ne déchiffrent jamais le coffre OPCO, et réciproquement.
 * Changer une clé sans garder l'ancienne dans _PREVIOUS rend les jetons
 * illisibles : il faudrait alors reconnecter Meta.
 */

type Cle = { kid: string; key: string }

const empreinte = (k: string) => createHash('sha256').update(k).digest('hex').slice(0, 12)
const liste = (v?: string) => (v || '').split(',').map((x) => x.trim()).filter(Boolean)
const derivee = (k: string) => createHash('sha256').update(`prospects:${k}`).digest('hex')

function trousseau(): Cle[] {
  const cles: Cle[] = []
  for (const k of [process.env.PROSPECTS_SECRET_KEY || '', ...liste(process.env.PROSPECTS_SECRET_KEY_PREVIOUS)].filter(Boolean)) {
    cles.push({ kid: `env:${empreinte(k)}`, key: k })
  }
  for (const k of [process.env.OPCO_SECRET_KEY || '', ...liste(process.env.OPCO_SECRET_KEY_PREVIOUS)].filter(Boolean)) {
    cles.push({ kid: `opco:${empreinte(k)}`, key: derivee(k) })
  }
  for (const k of [process.env.SUPABASE_SERVICE_ROLE_KEY || '', ...liste(process.env.SUPABASE_SERVICE_ROLE_KEY_PREVIOUS)].filter(Boolean)) {
    cles.push({ kid: `srk:${empreinte(k)}`, key: derivee(k) })
  }
  if (!cles.length) throw new Error('Coffre des canaux : aucune clé de chiffrement')
  return cles
}

export function chiffrerSecrets(objet: Record<string, unknown>): EncryptedBlob {
  const [cle] = trousseau()
  return encryptSecret(objet, cle.key, null, cle.kid)
}

/**
 * Secrets en clair, ou null s'ils sont illisibles (clé changée, blob abîmé).
 * Le déchiffrement coûte quelques dizaines de millisecondes (scrypt) : le
 * résultat est gardé en mémoire de l'instance quelques minutes.
 */
const cache = new Map<string, { valeur: any; jusqua: number }>()
const DUREE_CACHE_MS = 5 * 60 * 1000

export function dechiffrerSecrets<T = Record<string, string>>(blob: EncryptedBlob | null | undefined): T | null {
  if (!blob || typeof blob !== 'object' || !blob.ct) return null
  const cleCache = `${blob.kid || ''}:${blob.iv}:${blob.tag}`
  const enCache = cache.get(cleCache)
  if (enCache && enCache.jusqua > Date.now()) return enCache.valeur as T
  const cles = trousseau()
  const ordre = blob.kid ? [...cles.filter((c) => c.kid === blob.kid), ...cles.filter((c) => c.kid !== blob.kid)] : cles
  for (const c of ordre) {
    const valeur = decryptSecret<T>(blob, c.key)
    if (valeur) {
      cache.set(cleCache, { valeur, jusqua: Date.now() + DUREE_CACHE_MS })
      return valeur
    }
  }
  return null
}
