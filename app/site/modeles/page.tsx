import Link from 'next/link'
import { ArrowRight, Download, Printer, CheckCircle2 } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { jsonLd } from '../jsonld'
import { MODELES, apercuModele, nomModele } from '@/lib/modeles'

const BASE = 'https://www.lab-learning.fr'

export const metadata = {
  title: 'Modèles gratuits pour votre restaurant',
  description:
    'Tableau des allergènes, relevé de températures, plan de nettoyage, trame de document unique : quatre modèles gratuits à imprimer pour votre restaurant.',
  alternates: { canonical: '/modeles' },
}

export default function SiteModeles() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Modèles gratuits' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Modèles gratuits pour les restaurateurs',
      itemListElement: MODELES.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.titre, url: `${BASE}/modeles/${m.slug}` })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-10">
          <Kicker className="mb-5">Modèles gratuits</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">
            Les documents de votre cuisine, <span className="text-[#205040]">prêts à imprimer</span>
          </h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">
            Allergènes, températures, nettoyage, document unique : les quatre documents que nos formateurs voient manquer le plus souvent en restauration rapide. Imprimez-les, remplissez-les, affichez-les.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#44403C]">
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#205040]" />Gratuits</li>
            <li className="inline-flex items-center gap-2"><Printer className="h-4 w-4 text-[#205040]" />A4 paysage, à remplir à la main</li>
            <li className="inline-flex items-center gap-2"><Download className="h-4 w-4 text-[#205040]" />Envoyés par e-mail en PDF</li>
          </ul>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 md:px-8 pb-14">
        <div className="grid gap-5 md:grid-cols-2">
          {MODELES.map((m, i) => (
            <Reveal key={m.slug} delay={(i % 2) * 70}>
              <Link href={`/modeles/${m.slug}`} className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg hover:shadow-black/5 ll-lift">
                <div className="bg-[#EEF1EF] px-6 pt-6">
                  <img loading={i > 1 ? 'lazy' : undefined} src={apercuModele(m.slug)} alt={`Aperçu du modèle : ${nomModele(m).toLowerCase()}`} width={1287} height={910}
                    className="w-full rounded-t-lg shadow-[0_-2px_18px_rgba(15,23,42,0.10)] ring-1 ring-black/5" />
                </div>
                <div className="flex flex-1 flex-col p-5 md:p-6">
                  <h2 className="font-heading text-lg font-bold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{nomModele(m)}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#57534E]">{m.accroche}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#78716C]">{m.format}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#205040] group-hover:gap-2.5 transition-all">Recevoir le modèle <ArrowRight className="h-3.5 w-3.5" /></span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#78716C]">
          Ces modèles sont des points de départ : ils se complètent avec vos recettes, vos produits et votre organisation. Ils ne remplacent ni votre plan de maîtrise sanitaire ni l&apos;évaluation des risques propre à votre établissement.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-5 md:px-8 pb-20">
        <div className="rounded-3xl bg-[#205040] text-white p-7 md:p-10">
          <h2 className="ll-display text-2xl md:text-3xl text-white">Un document, c&apos;est bien. Une équipe formée, c&apos;est mieux.</h2>
          <p className="mt-3 text-white/85 max-w-2xl">Nos formateurs viennent dans votre établissement et travaillent sur vos propres documents, en hygiène alimentaire comme en prévention des risques.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/branches/restauration-rapide" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#205040] hover:bg-white/90 transition-colors">
              Voir nos formations <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/guides" className="inline-flex min-h-11 items-center gap-2 rounded-full ring-1 ring-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Lire nos guides
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
