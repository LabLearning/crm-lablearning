/**
 * Lecture, côté serveur, d'une image de signature (data:image/png;base64,…)
 * pour savoir si elle porte un tracé. Décodage PNG minimal avec zlib : les
 * cadres de signature produisent tous du PNG 8 bits, RGB ou RGBA, non
 * entrelacé. Tout autre format est rendu « inconnu » (null) : une signature
 * déjà enregistrée n'est jamais écartée pour cette raison (signatureVide),
 * une signature nouvelle n'est pas acceptée (refusSignature).
 */
import { inflateSync } from 'node:zlib'
import { MESSAGE_SIGNATURE_VIDE, compterEncre, seuilEncre } from '@/lib/signature-encre'

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const PREFIXE_PNG = 'data:image/png;base64,'
/** Taille maximale d'une signature nouvelle, en caractères : cinq fois la plus grosse des 2 430 images en base au 08/10/2026 (78 318). */
const TAILLE_MAX_SIGNATURE = 400_000
const MESSAGE_SIGNATURE_ILLISIBLE = 'Signature illisible, effacez-la et recommencez.'

/** Points d'encre et dimensions d'une image de signature, ou null si elle ne se lit pas. */
export function analyserSignature(
  dataUrl: string | null | undefined,
): { encre: number; largeur: number; hauteur: number } | null {
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

    const ligne = largeur * canaux
    // Décompression plafonnée à ce que les dimensions annoncent : un petit
    // fichier ne peut pas se déployer en centaines de mégaoctets en mémoire
    const brut = inflateSync(Buffer.concat(idat), { maxOutputLength: (ligne + 1) * hauteur })
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
    return { encre: compterEncre(points, canaux as 3 | 4), largeur, hauteur }
  } catch {
    return null
  }
}

/** Points d'encre d'une image de signature, ou null si elle ne se lit pas. */
export function encreSignature(dataUrl: string | null | undefined): number | null {
  return analyserSignature(dataUrl)?.encre ?? null
}

/**
 * Vrai seulement si l'image se lit et ne porte aucun tracé. Une image
 * illisible n'est pas dite vide : on ne refuse et on n'écarte que ce dont on
 * est sûr. Sert à relire les signatures déjà enregistrées.
 */
export function signatureVide(dataUrl: string | null | undefined): boolean {
  const image = analyserSignature(dataUrl)
  return image != null && image.encre < seuilEncre(image.largeur, image.hauteur)
}

/**
 * Contrôle d'une signature NOUVELLE, à appeler avant tout enregistrement :
 * renvoie le message à montrer au signataire, ou null si l'image est
 * acceptable. À l'inverse de signatureVide, ce qui ne se lit pas est refusé :
 * les cadres de signature n'envoient que du PNG, et le signataire, encore
 * devant l'écran, peut recommencer.
 */
export function refusSignature(dataUrl: string | null | undefined): string | null {
  if (!dataUrl) return MESSAGE_SIGNATURE_VIDE
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PREFIXE_PNG) || dataUrl.length > TAILLE_MAX_SIGNATURE) {
    return MESSAGE_SIGNATURE_ILLISIBLE
  }
  const image = analyserSignature(dataUrl)
  if (!image) return MESSAGE_SIGNATURE_ILLISIBLE
  return image.encre < seuilEncre(image.largeur, image.hauteur) ? MESSAGE_SIGNATURE_VIDE : null
}
