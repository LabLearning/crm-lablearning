import Link from 'next/link'
import { ArrowRight, Download, Printer, CheckCircle2, BookOpen } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { jsonLd } from '../jsonld'
import { MODELES, THEMES_MODELES, apercuModele, formatModele, nomModele } from '@/lib/modeles'

const BASE = 'https://www.lab-learning.fr'

export const metadata = {
  title: 'Modèles gratuits pour votre restaurant',
  description:
    'PMS complet, tableau des allergènes, relevé de températures, plan de nettoyage, huiles de friture, DUERP : douze modèles gratuits pour votre restaurant.',
  alternates: { canonical: '/modeles' },
}

export default function SiteModeles() {
  const vedette = MODELES.find((m) => m.vedette) || null
  const autres = MODELES.filter((m) => !m.vedette)

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
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-12">
          <Kicker className="mb-5">Modèles gratuits</Kicker>
          <h1 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">
            Les documents de votre cuisine, <span className="text-[#205040]">prêts à imprimer</span>
          </h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">
            Le plan de maîtrise sanitaire complet, et chacune de ses fiches : allergènes, températures, nettoyage, huiles de friture, traçabilité. Imprimez-les, remplissez-les, affichez-les.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#44403C]">
            <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#205040]" />{MODELES.length} modèles gratuits</li>
            <li className="inline-flex items-center gap-2"><Printer className="h-4 w-4 text-[#205040]" />A4 paysage, à remplir à la main</li>
            <li className="inline-flex items-center gap-2"><Download className="h-4 w-4 text-[#205040]" />Envoyés par e-mail en PDF</li>
          </ul>
        </div>
      </section>

      {vedette && (
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16 md:pb-20">
          <div className="grid overflow-hidden rounded-3xl bg-[#205040] text-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="p-7 md:p-10 lg:p-12">
              <span className="inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#5CD9A0]">Le classeur complet</span>
              <h2 className="mt-4 ll-display text-3xl md:text-[2.6rem] text-white text-balance">{nomModele(vedette)}</h2>
              <p className="mt-4 text-white/85 leading-relaxed max-w-xl">{vedette.accroche}</p>
              <ul className="mt-5 space-y-2.5">
                {vedette.contenu.slice(1, 4).map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-white/90">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#5CD9A0]" /><span>{c}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={`/modeles/${vedette.slug}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#205040] hover:bg-white/90 transition-colors">
                  <Download className="h-4 w-4" /> Recevoir le PMS
                </Link>
                <Link href={`/guides/${vedette.guides[0]}`} className="inline-flex min-h-12 items-center gap-2 rounded-full ring-1 ring-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                  <BookOpen className="h-4 w-4" /> C&apos;est quoi, un PMS ?
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/60">{formatModele(vedette)}</p>
            </div>
            <Link href={`/modeles/${vedette.slug}`} className="relative flex items-center bg-[#1a4335] p-6 md:p-8 lg:p-10" aria-label={`Voir le modèle : ${nomModele(vedette)}`}>
              <img src={apercuModele(vedette.slug)} alt={`Aperçu de la couverture : ${nomModele(vedette).toLowerCase()}`} width={1287} height={910}
                className="w-full rounded-xl shadow-2xl shadow-black/30" />
            </Link>
          </div>
        </section>
      )}

      {THEMES_MODELES.map((theme) => {
        const liste = autres.filter((m) => m.theme === theme)
        if (!liste.length) return null
        return (
          <section key={theme} className="max-w-6xl mx-auto px-5 md:px-8 pb-16 md:pb-20">
            <div className="flex items-end justify-between gap-4 border-b border-[#205040]/10 pb-4">
              <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">{theme}</h2>
              <span className="text-sm text-[#78716C]">{liste.length} modèles</span>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((m, i) => (
                <Reveal key={m.slug} delay={(i % 3) * 70}>
                  <Link href={`/modeles/${m.slug}`} className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-lg hover:shadow-black/5 ll-lift">
                    <div className="bg-[#F6F4EF] px-5 pt-5">
                      <img loading="lazy" src={apercuModele(m.slug)} alt={`Aperçu du modèle : ${nomModele(m).toLowerCase()}`} width={1287} height={910}
                        className="w-full rounded-t-lg shadow-[0_-2px_18px_rgba(15,23,42,0.10)] ring-1 ring-black/5" />
                    </div>
                    <div className="flex flex-1 flex-col p-5 md:p-6">
                      <h3 className="font-heading text-lg font-bold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{nomModele(m)}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#57534E] line-clamp-3">{m.accroche}</p>
                      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#78716C]">{m.pages} page{m.pages > 1 ? 's' : ''}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#205040] group-hover:gap-2.5 transition-all">Recevoir <ArrowRight className="h-3.5 w-3.5" /></span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )
      })}

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20 md:pb-24">
        <p className="max-w-3xl text-sm leading-relaxed text-[#78716C]">
          Ces modèles sont des points de départ : ils se complètent avec vos recettes, vos produits et votre organisation. Ils ne remplacent ni la formation à l&apos;hygiène alimentaire ni l&apos;évaluation des risques propre à votre établissement.
        </p>
        <div className="mt-10 rounded-3xl bg-[#F6F4EF] p-7 md:p-10">
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Un document, c&apos;est bien. Une équipe formée, c&apos;est mieux.</h2>
          <p className="mt-3 text-[#57534E] max-w-2xl">Nos formateurs viennent dans votre établissement et travaillent sur vos propres documents, en hygiène alimentaire comme en prévention des risques.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/branches/restauration-rapide" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#205040] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors">
              Voir nos formations <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/guides" className="inline-flex min-h-11 items-center gap-2 rounded-full ring-1 ring-[#205040]/30 px-5 py-2.5 text-sm font-semibold text-[#205040] hover:bg-[#205040]/5 transition-colors">
              Lire nos guides
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
