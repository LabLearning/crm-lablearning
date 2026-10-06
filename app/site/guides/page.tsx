import Link from 'next/link'
import { ArrowRight, Clock, Download } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { jsonLd } from '../jsonld'
import { GUIDES, guidesPublies } from '@/lib/guides'

export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

export async function generateMetadata({ searchParams }: { searchParams: { apercu?: string } }) {
  const vide = guidesPublies().length === 0
  return {
    title: 'Guides : hygiène, sécurité, financement',
    description:
      'Nos guides pour les restaurateurs : formation hygiène alimentaire obligatoire, document unique, allergènes, financement OPCO, ouverture d’un restaurant rapide.',
    alternates: { canonical: '/guides' },
    // Tant qu'aucun guide n'est publié, et en mode relecture, la page reste hors des moteurs
    robots: vide || searchParams?.apercu ? { index: false, follow: false } : { index: true, follow: true },
  }
}

export default function SiteGuides({ searchParams }: { searchParams: { apercu?: string } }) {
  // ?apercu=1 : la liste montre aussi les brouillons, pour la relecture
  const relecture = !!searchParams?.apercu
  const guides = relecture ? GUIDES : guidesPublies()

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Guides Lab Learning',
      itemListElement: guidesPublies().map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.titre, url: `${BASE}/guides/${g.slug}` })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-10">
          <Kicker className="mb-5">Guides</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">
            Les réponses aux questions <span className="text-[#205040]">des restaurateurs</span>
          </h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">
            Hygiène alimentaire, sécurité de l&apos;équipe, financement, ouverture : ce que disent les textes, expliqué simplement, avec les sources officielles.
          </p>
          {relecture && <p className="mt-4 inline-block rounded-lg bg-[#FEF3E2] px-3 py-1.5 text-sm text-[#7C2D12]">Mode relecture : les brouillons sont affichés.</p>}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
        {guides.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-10 text-center text-[#78716C]">
            Nos premiers guides arrivent. En attendant, <Link href="/faq" className="font-semibold text-[#205040]">consultez nos questions fréquentes</Link>.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {guides.map((g, i) => (
              <Reveal key={g.slug} delay={(i % 3) * 70}>
                <Link href={`/guides/${g.slug}`} className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg hover:shadow-black/5 ll-lift">
                  <img loading="lazy" src={g.image} alt={g.imageAlt} className="aspect-[16/9] w-full object-cover" />
                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#205040]">
                      {g.categorie}
                      {!g.publie && <span className="rounded bg-[#FEF3E2] px-1.5 py-0.5 normal-case tracking-normal text-[#7C2D12]">Brouillon</span>}
                    </div>
                    <h2 className="mt-2 font-heading text-lg font-bold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{g.titre}</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#57534E] line-clamp-3">{g.chapeau}</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 text-[#78716C]"><Clock className="h-3.5 w-3.5" />{g.lecture} min</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#205040] group-hover:gap-2.5 transition-all">Lire le guide <ArrowRight className="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <Link href="/modeles" className="group mt-8 flex items-center gap-4 rounded-3xl bg-[#F6F4EF] hover:bg-[#EFEBE2] p-5 md:p-6 transition-colors">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#205040] text-white"><Download className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-bold text-[#14110F]">Modèles gratuits à imprimer</span>
            <span className="mt-0.5 block text-sm text-[#57534E]">Tableau des allergènes, relevé de températures, plan de nettoyage, trame de document unique.</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-[#205040] group-hover:translate-x-1 transition-transform" />
        </Link>
      </section>
    </>
  )
}
