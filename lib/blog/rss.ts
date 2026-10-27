import { articlesParus, jourParis, type Article } from './index'

/**
 * Flux RSS du blog (https://www.lab-learning.fr/blog/rss.xml) : les articles
 * parus, du plus récent au plus ancien. Un outil de publication (Make,
 * Zapier…) le surveille et publie chaque nouvel article sur la page LinkedIn.
 * Un article attend sa date (minuit, heure de Paris) avant d'y entrer, comme
 * sur le site.
 */
export const SITE = 'https://www.lab-learning.fr'
export const ADRESSE_FLUX = `${SITE}/blog/rss.xml`

const xml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string))
const absolue = (chemin: string) => (/^https?:\/\//.test(chemin) ? chemin : `${SITE}${chemin.startsWith('/') ? '' : '/'}${chemin}`)

/** Minuit à Paris ce jour-là (l'heure de parution d'un article), heure d'hiver ou d'été */
export function minuitParis(jour: string): Date {
  for (const decalage of ['+01:00', '+02:00']) {
    const d = new Date(`${jour}T00:00:00${decalage}`)
    const heure = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d)
    if (jourParis(d) === jour && heure === '00') return d
  }
  return new Date(`${jour}T00:00:00Z`)
}

const typeImage = (chemin: string) => (/\.png$/i.test(chemin) ? 'image/png' : /\.jpe?g$/i.test(chemin) ? 'image/jpeg' : 'image/webp')

export function fluxRss(articles: Article[] = articlesParus(), maintenant = new Date()): string {
  const items = articles.map((a) => {
    const lien = `${SITE}/blog/${a.slug}`
    return `    <item>
      <title>${xml(a.titre)}</title>
      <link>${xml(lien)}</link>
      <guid isPermaLink="true">${xml(lien)}</guid>
      <pubDate>${minuitParis(a.publieLe).toUTCString()}</pubDate>
      <category>${xml(a.categorie)}</category>
      <description>${xml(a.chapeau || a.description)}</description>${a.image ? `
      <media:content url="${xml(absolue(a.image))}" medium="image" type="${typeImage(a.image)}"><media:description>${xml(a.imageAlt || a.titre)}</media:description></media:content>` : ''}
    </item>`
  }).join('\n')
  const derniere = articles[0] ? minuitParis(articles[0].publieLe) : maintenant
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Le blog Lab Learning</title>
    <link>${SITE}/blog</link>
    <description>Hygiène, réglementation, financement, équipe : des conseils pratiques pour la restauration et les métiers de bouche, par Lab Learning.</description>
    <language>fr-FR</language>
    <lastBuildDate>${derniere.toUTCString()}</lastBuildDate>
    <atom:link href="${ADRESSE_FLUX}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE}/site/logos/lab-learning-fonce.png</url>
      <title>Le blog Lab Learning</title>
      <link>${SITE}/blog</link>
    </image>
${items}
  </channel>
</rss>
`
}
