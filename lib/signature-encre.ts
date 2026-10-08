/**
 * Une signature tracée contient-elle vraiment un tracé ?
 *
 * Un cadre de signature validé sans rien dessiner (un simple appui du doigt)
 * donnait une image blanche, enregistrée comme une signature. On compte donc
 * l'encre : les points visibles et nettement plus sombres que le fond.
 *
 * Ce fichier ne dépend ni du navigateur ni de Node : il sert au cadre de
 * signature (avant l'envoi) comme au serveur (avant l'enregistrement).
 */

/** En dessous, ce n'est pas une signature : un point ou un trait de quelques millimètres. */
export const SEUIL_ENCRE = 120

/**
 * Seuil d'encre pour une image de cette taille : un point d'encre pour mille
 * points d'image, jamais moins que SEUIL_ENCRE. Le cadre du portail produit
 * une image d'autant plus grande que l'écran est fin (taille affichée × ratio
 * de pixels) : avec un seuil fixe, un trait de moins d'un millimètre y passait
 * pour une signature. Rapport vérifié le 08/10/2026 sur les 2 428 signatures
 * tracées de la base : la plus faible porte 3,6 fois son seuil.
 */
export function seuilEncre(largeur: number, hauteur: number): number {
  return Math.max(SEUIL_ENCRE, Math.round((largeur * hauteur) / 1000))
}

export const MESSAGE_SIGNATURE_VIDE =
  'Votre signature n’apparaît pas dans le cadre. Tracez-la avec le doigt ou la souris, puis validez.'

/**
 * Nombre de points d'encre dans une image RGBA (4 octets par point) ou RGB
 * (3 octets). Un point compte s'il est visible et sombre : fond blanc comme
 * fond transparent sont ignorés.
 */
export function compterEncre(points: ArrayLike<number>, canaux: 3 | 4 = 4): number {
  let encre = 0
  for (let i = 0; i + canaux - 1 < points.length; i += canaux) {
    if (canaux === 4 && points[i + 3] < 48) continue
    // Luminance approchée : un tracé est sombre, le fond est clair
    if (points[i] * 0.299 + points[i + 1] * 0.587 + points[i + 2] * 0.114 < 160) encre++
  }
  return encre
}

/** Le cadre de signature porte-t-il un tracé ? (navigateur) */
export function cadreSigne(canvas: HTMLCanvasElement | null): boolean {
  if (!canvas) return false
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return true
    const encre = compterEncre(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
    return encre >= seuilEncre(canvas.width, canvas.height)
  } catch {
    // Lecture des points refusée par le navigateur : le serveur vérifiera
    return true
  }
}
