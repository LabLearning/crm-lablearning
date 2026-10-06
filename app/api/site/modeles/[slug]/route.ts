import { NextResponse } from 'next/server'
import { modeleParSlug } from '@/lib/modeles'
import { rendreModele, telechargementValide } from '@/lib/modeles-acces'

export const dynamic = 'force-dynamic'

/**
 * Téléchargement d'un modèle gratuit du site. Le lien est signé et remis après
 * la demande (à l'écran et par e-mail) : sans jeton valide, le visiteur est
 * renvoyé vers la page du modèle.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const modele = modeleParSlug(params.slug)
  if (!modele) return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })
  const jeton = new URL(req.url).searchParams.get('j')
  if (!telechargementValide(modele.slug, jeton)) {
    return NextResponse.redirect(new URL(`https://www.lab-learning.fr/modeles/${modele.slug}`), 302)
  }
  const pdf = await rendreModele(modele.slug)
  if (!pdf) return NextResponse.json({ error: 'Modèle indisponible' }, { status: 500 })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${modele.fichier}"`,
      'Cache-Control': 'private, max-age=0',
      'X-Robots-Tag': 'noindex',
    },
  })
}
