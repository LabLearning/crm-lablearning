import Link from 'next/link'
import { ArrowRight, Clock, BookOpen, Download } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { jsonLd } from '../jsonld'
import { ARTICLES, CATEGORIES_ARTICLES, articlesParus, estParu, jourParis, prochaineParution, slugCategorie } from '@/lib/blog'
import type { Article } from '@/lib/blog'

// Rendu à chaque visite : un article paraît le jour prévu, sans redéploiement
export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

const dateFr = (iso: string, an = true) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(an ? { year: 'numeric' } : {}), timeZone: 'Europe/Paris' })

export async function generateMetadata({ searchParams }: { searchParams: { apercu?: string; categorie?: string } }) {
  return {
    title: 'Blog : conseils aux restaurateurs',
    description:
      'Hygiène, chaîne du froid, allergènes, sécurité, financement de la formation : des conseils pratiques pour les restaurants et commerces de bouche, chaque semaine.',
    alternates: { canonical: '/blog' },
    // La file d'attente se relit en ligne mais reste hors des moteurs
    robots: searchParams?.apercu ? { index: false, follow: false } : { index: true, follow: true },
  }
}

function Carte({ a, relecture, i }: { a: Article; relecture: boolean; i: number }) {
  const attente = relecture && !estParu(a)
  return (
    <Reveal delay={(i % 3) * 70}>
      <Link href={`/blog/${a.slug}${attente ? '?apercu=1' : ''}`} className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg hover:shadow-black/5 ll-lift">
        <img loading="lazy" src={a.image} alt={a.imageAlt} className="aspect-[16/9] w-full object-cover" />
        <div className="flex flex-1 flex-col p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#205040]">
            {a.categorie}
            {attente && <span className="rounded bg-[#FEF3E2] px-1.5 py-0.5 normal-case tracking-normal text-[#7C2D12]">Paraît le {dateFr(a.publieLe)}</span>}
          </div>
          <h2 className="mt-2 font-heading text-lg font-bold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{a.titre}</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[#57534E] line-clamp-3">{a.chapeau}</p>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-[#78716C]">
              <time dateTime={a.publieLe}>{dateFr(a.publieLe)}</time>
              <span aria-hidden="true">·</span>
              <Clock className="h-3.5 w-3.5" />{a.lecture} min
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#205040] group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>
    </Reveal>
  )
}

export default function SiteBlog({ searchParams }: { searchParams: { apercu?: string; categorie?: string } }) {
  // ?apercu=1 : la liste montre aussi les articles qui attendent leur date, pour la relecture
  const relecture = !!searchParams?.apercu
  const jour = jourParis()
  const parus = articlesParus(jour)
  const tous = relecture ? ARTICLES : parus
  const categorie = CATEGORIES_ARTICLES.find((c) => slugCategorie(c) === searchParams?.categorie) || null
  const liste = categorie ? tous.filter((a) => a.categorie === categorie) : tous
  const [une, ...suite] = categorie ? [null, ...liste] : liste
  const presentes = CATEGORIES_ARTICLES.filter((c) => tous.some((a) => a.categorie === c))
  const prochaine = prochaineParution(jour)
  const lienCategorie = (c: string | null) => {
    const q = new URLSearchParams()
    if (c) q.set('categorie', slugCategorie(c))
    if (relecture) q.set('apercu', '1')
    const s = q.toString()
    return s ? `/blog?${s}` : '/blog'
  }

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Blog Lab Learning',
      url: `${BASE}/blog`,
      publisher: { '@id': `${BASE}/#organization` },
      blogPost: parus.slice(0, 20).map((a) => ({
        '@type': 'BlogPosting',
        headline: a.titre,
        url: `${BASE}/blog/${a.slug}`,
        datePublished: a.publieLe,
        dateModified: a.majLe,
        image: `${BASE}${a.image}`,
      })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-8">
          <Kicker className="mb-5">Blog</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">
            Des conseils concrets <span className="text-[#205040]">pour votre établissement</span>
          </h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">
            Hygiène, chaîne du froid, allergènes, sécurité de l&apos;équipe, financement de la formation : un nouvel article chaque semaine, appuyé sur les textes officiels.
          </p>
          {prochaine && !relecture && (
            <p className="mt-3 text-sm text-[#78716C]">Prochain article le {dateFr(prochaine, false)}.</p>
          )}
          {relecture && <p className="mt-4 inline-block rounded-lg bg-[#FEF3E2] px-3 py-1.5 text-sm text-[#7C2D12]">Mode relecture : les articles en attente de leur date sont affichés.</p>}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
        {presentes.length > 1 && (
          <nav aria-label="Thèmes" className="flex flex-wrap gap-2">
            {[null, ...presentes].map((c) => {
              const actif = c === categorie
              return (
                <Link key={c || 'tous'} href={lienCategorie(c)} aria-current={actif ? 'page' : undefined}
                  className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors ${actif ? 'bg-[#205040] text-white' : 'bg-white text-[#44403C] ring-1 ring-black/10 hover:ring-[#205040]/30 hover:text-[#205040]'}`}>
                  {c || 'Tous les articles'}
                </Link>
              )
            })}
          </nav>
        )}

        {liste.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-10 text-center text-[#78716C]">
            Aucun article dans ce thème pour l&apos;instant. <Link href="/blog" className="font-semibold text-[#205040]">Voir tous les articles</Link>.
          </div>
        ) : (
          <>
            {une && (
              <Link href={`/blog/${une.slug}${relecture && !estParu(une) ? '?apercu=1' : ''}`} className="group mt-8 grid overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg hover:shadow-black/5 ll-lift md:grid-cols-2">
                <img src={une.image} alt={une.imageAlt} className="aspect-[16/9] md:aspect-auto md:h-full w-full object-cover" />
                <div className="flex flex-col justify-center p-6 md:p-9">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#205040]">À la une · {une.categorie}</div>
                  <h2 className="mt-2 ll-display text-2xl md:text-[1.9rem] leading-tight text-[#14110F] group-hover:text-[#205040] transition-colors text-balance">{une.titre}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#57534E] line-clamp-4">{une.chapeau}</p>
                  <div className="mt-5 flex items-center gap-3 text-sm text-[#78716C]">
                    <time dateTime={une.publieLe}>{dateFr(une.publieLe)}</time>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{une.lecture} min de lecture</span>
                  </div>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] group-hover:gap-2.5 transition-all">Lire l&apos;article <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            )}
            {suite.length > 0 && (
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {suite.map((a, i) => a && <Carte key={a.slug} a={a} relecture={relecture} i={i} />)}
              </div>
            )}
          </>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link href="/guides" className="group flex items-center gap-4 rounded-3xl bg-[#F6F4EF] hover:bg-[#EFEBE2] p-5 md:p-6 transition-colors">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#205040] text-white"><BookOpen className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading font-bold text-[#14110F]">Les guides complets</span>
              <span className="mt-0.5 block text-sm text-[#57534E]">Formation hygiène obligatoire, document unique, allergènes, contrôle sanitaire, financement.</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#205040] group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/modeles" className="group flex items-center gap-4 rounded-3xl bg-[#F6F4EF] hover:bg-[#EFEBE2] p-5 md:p-6 transition-colors">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#205040] text-white"><Download className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading font-bold text-[#14110F]">Modèles gratuits à imprimer</span>
              <span className="mt-0.5 block text-sm text-[#57534E]">Tableau des allergènes, relevé de températures, plan de nettoyage, trame de document unique.</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#205040] group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </>
  )
}
