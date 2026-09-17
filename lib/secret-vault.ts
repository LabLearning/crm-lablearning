import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

/**
 * Coffre-fort : chiffre/déchiffre un objet (identifiants d'un compte) avec une
 * clé dérivée d'un mot de passe fourni par l'utilisateur (AES-256-GCM).
 * Le mot de passe n'est JAMAIS stocké — seul le blob chiffré l'est. Sans le bon
 * mot de passe, le déchiffrement échoue (auth tag GCM invalide).
 */
export interface EncryptedBlob {
  v: 1
  salt: string   // base64
  iv: string     // base64
  ct: string     // base64 (ciphertext)
  tag: string    // base64 (auth tag GCM)
  hint?: string | null
  /** Identifiant de la clé de chiffrement, pour retrouver la bonne clé d'un trousseau. */
  kid?: string | null
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })
}

export function encryptSecret(plain: unknown, password: string, hint?: string | null, kid?: string | null): EncryptedBlob {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(password, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64'), tag: tag.toString('base64'), hint: hint || null, kid: kid || null }
}

/** Retourne l'objet déchiffré, ou null si le mot de passe est incorrect. */
export function decryptSecret<T = any>(blob: EncryptedBlob, password: string): T | null {
  try {
    const salt = Buffer.from(blob.salt, 'base64')
    const iv = Buffer.from(blob.iv, 'base64')
    const key = deriveKey(password, salt)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'))
    const pt = Buffer.concat([decipher.update(Buffer.from(blob.ct, 'base64')), decipher.final()])
    return JSON.parse(pt.toString('utf8')) as T
  } catch {
    return null // mot de passe incorrect ou blob corrompu
  }
}
