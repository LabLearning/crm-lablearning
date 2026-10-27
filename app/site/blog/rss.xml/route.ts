import { fluxRss } from '@/lib/blog/rss'

/**
 * Flux RSS du blog, servi à https://www.lab-learning.fr/blog/rss.xml (la
 * section /blog du domaine public mène à /site/blog). Relu à chaque appel :
 * l'article du mardi y entre à minuit, heure de Paris ; les lecteurs gardent
 * une copie quinze minutes.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return new Response(fluxRss(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  })
}
