import Link from 'next/link'
import { ArrowRight, MapPin } from '../icons'
import { Reveal } from '../Reveal'
import { Kicker } from '../Kicker'
import { getVilles, type VilleData } from '@/lib/site-villes'
import { jsonLd } from '../jsonld'

export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

export const metadata = {
  title: 'Formation restauration rapide par ville',
  description:
    'Nos formations en restauration rapide, ville par ville : hygiène alimentaire, prévention des risques, management. En établissement, partout en France.',
  alternates: { canonical: '/formation-restauration-rapide' },
}

export default async function SiteVilles() {
  const villes = await getVilles()
  const sessions = villes.reduce((s, v) => s + v.sessions, 0)

  // Regroupement par département, les plus formés d'abord
  const parDepartement = new Map<string, VilleData[]>()
  for (const v of villes) {
    const k = v.nomDepartement ? `${v.nomDepartement} (${v.departement})` : 'Autres'
    if (!parDepartement.has(k)) parDepartement.set(k, [])
    parDepartement.get(k)!.push(v)
  }
  const groupes = [...parDepartement.entries()].sort((a, b) => b[1].reduce((s, v) => s + v.sessions, 0) - a[1].reduce((s, v) => s + v.sessions, 0))

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Formation restauration rapide par ville' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Formation restauration rapide par ville',
      itemListElement: villes.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: v.nom, url: `${BASE}/formation-restauration-rapide/${v.slug}` })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-10">
          <Kicker className="mb-5">Partout en France</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">
            Formation restauration rapide, <span className="text-[#205040]">ville par ville</span>
          </h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">
            Nos formateurs se déplacent dans votre établissement, partout en France. Voici les {villes.length} villes où nous avons le plus formé,
            avec {sessions.toLocaleString('fr-FR')} sessions réalisées. Votre ville n&apos;y figure pas ? Nous y venons aussi.
          </p>
          <p className="mt-4 text-[#57534E]">
            Pour le détail des programmes : <Link href="/branches/restauration-rapide" className="font-semibold text-[#205040] hover:underline">nos formations restauration rapide</Link>.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 md:px-8 pb-16 space-y-10">
        {groupes.map(([departement, liste]) => (
          <div key={departement}>
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-[#14110F] border-b border-[#205040]/10 pb-3 mb-4">
              <MapPin className="h-4 w-4 text-[#205040]" /> {departement}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((v, i) => (
                <Reveal key={v.slug} delay={(i % 3) * 60}>
                  <Link href={`/formation-restauration-rapide/${v.slug}`} className="group flex items-center justify-between gap-4 rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-5 ll-lift">
                    <div className="min-w-0">
                      <div className="font-heading font-semibold text-[#14110F] group-hover:text-[#205040] transition-colors">{v.nom}</div>
                      <div className="mt-0.5 text-sm text-[#78716C]">{v.sessions} sessions · {v.stagiaires} stagiaires formés</div>
                    </div>
                    <span className="shrink-0 h-9 w-9 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] group-hover:bg-[#205040] group-hover:text-white transition-colors">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="max-w-3xl mx-auto px-5 md:px-8 pb-20 text-center">
        <p className="text-[#57534E]">
          Votre établissement est ailleurs en France ?{' '}
          <Link href="/contact" className="inline-flex items-center gap-1.5 font-semibold text-[#205040] hover:gap-2.5 transition-all">
            Parlons de votre projet <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </section>
    </>
  )
}
