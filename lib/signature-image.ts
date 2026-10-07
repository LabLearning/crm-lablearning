/**
 * Lecture, côté serveur, d'une image de signature (data:image/png;base64,…)
 * pour savoir si elle porte un tracé. Décodage PNG minimal avec zlib : les
 * cadres de signature produisent tous du PNG 8 bits, RGB ou RGBA, non
 * entrelacé. Tout autre format est rendu « inconnu » (null) et n'est jamais
 * refusé pour cette raison.
 */
import { inflateSync } from 'node:zlib'
import { SEUIL_ENCRE, compterEncre } from '@/lib/signature-encre'

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Points d'encre d'une image de signature, ou null si elle ne se lit pas. */
export function encreSignature(dataUrl: string | null | undefined): number | null {
  const m = /^data:image\/png;base64,([\s\S]+)$/.exec(String(dataUrl || ''))
  if (!m) return null
  try {
    const png = Buffer.from(m[1], 'base64')
    if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE_PNG)) return null
    let largeur = 0, hauteur = 0, profondeur = 0, type = 0, entrelace = 0
    const idat: Buffer[] = []
    for (let o = 8; o + 12 <= png.length;) {
      const taille = png.readUInt32BE(o)
      const nom = png.toString('latin1', o + 4, o + 8)
      const corps = png.subarray(o + 8, o + 8 + taille)
      if (nom === 'IHDR') {
        largeur = corps.readUInt32BE(0); hauteur = corps.readUInt32BE(4)
        profondeur = corps[8]; type = corps[9]; entrelace = corps[12]
      } else if (nom === 'IDAT') idat.push(corps)
      else if (nom === 'IEND') break
      o += 12 + taille
    }
    const canaux = type === 6 ? 4 : type === 2 ? 3 : 0
    if (!canaux || profondeur !== 8 || entrelace !== 0 || !largeur || !hauteur) return null
    // Une signature tient dans quelques centaines de milliers de points
    if (largeur * hauteur > 6_000_000) return null

    const brut = inflateSync(Buffer.concat(idat))
    const ligne = largeur * canaux
    if (brut.length < (ligne + 1) * hauteur) return null
    const points = Buffer.alloc(ligne * hauteur)
    for (let y = 0; y < hauteur; y++) {
      const filtre = brut[y * (ligne + 1)]
      const src = y * (ligne + 1) + 1
      const dst = y * ligne
      for (let x = 0; x < ligne; x++) {
        const a = x >= canaux ? points[dst + x - canaux] : 0
        const b = y > 0 ? points[dst + x - ligne] : 0
        const c = x >= canaux && y > 0 ? points[dst + x - ligne - canaux] : 0
        let v = brut[src + x]
        if (filtre === 1) v += a
        else if (filtre === 2) v += b
        else if (filtre === 3) v += (a + b) >> 1
        else if (filtre === 4) {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        }
        points[dst + x] = v & 0xff
      }
    }
    return compterEncre(points, canaux as 3 | 4)
  } catch {
    return null
  }
}

/**
 * Vrai seulement si l'image se lit et ne porte aucun tracé. Une image
 * illisible n'est pas dite vide : on ne refuse et on n'écarte que ce dont on
 * est sûr.
 */
export function signatureVide(dataUrl: string | null | undefined): boolean {
  const encre = encreSignature(dataUrl)
  return encre != null && encre < SEUIL_ENCRE
}
