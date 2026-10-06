import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, CheckCircle2, BookOpen, Printer, CalendarCheck } from '../../icons'
import { Kicker } from '../../Kicker'
import { jsonLd } from '../../jsonld'
import { formationsLiees } from '../../formations-liees'
import { ModeleForm } from '../ModeleForm'
import { MODELES, CLE_GARDE_MODELES, apercuModele, modeleParSlug, nomModele } from '@/lib/modeles'
import { guideParSlug } from '@/lib/guides'
import { emettreHorodatage } from '@/lib/inscription-formateur-garde'
import { titreFormation } from '@/lib/utils'

// La page émet un horodatage signé pour le formulaire : elle n'est jamais mise en cache
export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

const dateFr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const m = modeleParSlug(params.slug)
  if (!m) return { title: 'Modèle' }
  return {
    title: m.titreCourt,
    description: m.description,
    alternates: { canonical: `/modeles/${m.slug}` },
    openGraph: {
      type: 'article',
      title: m.titre,
      description: m.description,
      url: `/modeles/${m.slug}`,
      images: [{ url: apercuModele(m.slug), alt: `Aperçu du modèle : ${nomModele(m).toLowerCase()}` }],
    },
  }
}

export default async function SiteModele({ params }: { params: { slug: string } }) {
  const m = modeleParSlug(params.slug)
  if (!m) notFound()
  const liees = await formationsLiees(m.formations)
  const guides = m.guides.map((g) => guideParSlug(g)).filter((g) => g && g.publie) as NonNullable<ReturnType<typeof guideParSlug>>[]
  const autres = MODELES.filter((x) => x.slug !== m.slug)
  const nom = nomModele(m)

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Modèles gratuits', item: `${BASE}/modeles` },
        { '@type': 'ListItem', position: 3, name: nom },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: m.titre,
      description: m.description,
      image: `${BASE}${apercuModele(m.slug)}`,
      url: `${BASE}/modeles/${m.slug}`,
      inLanguage: 'fr',
      isAccessibleForFree: true,
      encodingFormat: 'application/pdf',
      dateModified: m.majLe,
      publisher: { '@id': `${BASE}/#organization` },
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-8">
          <Link href="/modeles" className="inline-flex items-center gap-1.5 text-sm text-[#57534E] hover:text-[#205040] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Tous les modèles
          </Link>
          <div className="mt-6"><Kicker>Modèle gratuit</Kicker></div>
          <h1 className="mt-3 ll-display ll-fluid-h1 text-[#14110F] text-balance max-w-3xl">{m.titre}</h1>
          <p className="mt-5 text-lg text-[#57534E] leading-relaxed max-w-2xl">{m.accroche}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#78716C]">
            <span className="inline-flex items-center gap-1.5"><Printer className="h-4 w-4" />{m.format}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4" />Mis à jour le {dateFr(m.majLe)}</span>
          </div>
        </div>
      </header>

      {/* Ordre de lecture sur téléphone : aperçu, formulaire, détail. Sur grand écran le formulaire reste à droite. */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 pb-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-10">
        <div className="rounded-3xl bg-[#EEF1EF] p-4 sm:p-6">
          <img src={apercuModele(m.slug)} alt={`Aperçu de la première page : ${nom.toLowerCase()}`} width={1287} height={910}
            className="w-full rounded-lg shadow-[0_6px_24px_rgba(15,23,42,0.12)] ring-1 ring-black/5" />
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="lg:sticky lg:top-28">
            <ModeleForm slug={m.slug} jetonPage={emettreHorodatage(CLE_GARDE_MODELES)} />
          </div>
        </div>

        <div className="lg:col-start-1">
          <h2 className="ll-display text-2xl md:text-[1.9rem] text-[#14110F]">Ce que contient le fichier</h2>
          <ul className="mt-5 space-y-3">
            {m.contenu.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[#44403C] leading-relaxed">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#205040]" /><span>{c}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-3 rounded-3xl bg-[#EEF1EF] p-4 sm:grid-cols-2 sm:p-5">
            {([2, 3] as const).map((n) => (
              <img key={n} loading="lazy" src={apercuModele(m.slug, n)} alt={`Aperçu de la page ${n} : ${nom.toLowerCase()}`} width={1287} height={910}
                className="w-full rounded-lg shadow-[0_6px_24px_rgba(15,23,42,0.12)] ring-1 ring-black/5" />
            ))}
          </div>

          <h2 className="mt-10 ll-display text-2xl md:text-[1.9rem] text-[#14110F]">Comment s&apos;en servir</h2>
          <ol className="mt-5 space-y-4">
            {m.usage.map((u, i) => (
              <li key={u} className="flex items-start gap-4 text-[#44403C] leading-relaxed">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#205040] font-heading text-sm font-bold text-white tabular-nums">{i + 1}</span>
                <span className="pt-1">{u}</span>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-sm leading-relaxed text-[#78716C]">
            Ce modèle est un point de départ, à adapter à votre établissement. Il ne remplace pas la lecture des textes ni un conseil adapté à votre situation.
          </p>

          {guides.length > 0 && (
            <div className="mt-10">
              <h2 className="font-heading text-lg font-bold text-[#14110F]">Comprendre la règle</h2>
              <div className="mt-4 space-y-3">
                {guides.map((g) => (
                  <Link key={g.slug} href={`/guides/${g.slug}`} className="group flex items-center gap-4 rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-3 pr-4 ll-lift">
                    <img loading="lazy" src={g.image} alt="" className="h-16 w-24 sm:w-28 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#205040]">{g.categorie}</div>
                      <div className="mt-0.5 font-heading font-semibold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{g.titre}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#205040]" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {liees.length > 0 && (
        <section className="bg-[#F6F4EF]">
          <div className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-14">
            <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Nos formations sur ce sujet</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {liees.map((f) => (
                <Link key={f.id} href={`/formations/${f.id}`} className="group flex flex-col rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-5 ll-lift">
                  <BookOpen className="h-5 w-5 text-[#205040]" />
                  <div className="mt-3 flex-1 font-heading font-semibold text-[#14110F] leading-snug group-hover:text-[#205040] transition-colors">{titreFormation(f.intitule)}</div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#78716C]">
                    <span>{f.duree_heures ? `${f.duree_heures} h` : 'En établissement'}</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#205040] group-hover:gap-2.5 transition-all">Voir le programme <ArrowRight className="h-3.5 w-3.5" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Les autres modèles</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {autres.map((x) => (
            <Link key={x.slug} href={`/modeles/${x.slug}`} className="group flex flex-col rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 ll-lift">
              <div className="bg-[#EEF1EF] px-4 pt-4">
                <img loading="lazy" src={apercuModele(x.slug)} alt="" width={1287} height={910} className="w-full rounded-t-md ring-1 ring-black/5" />
              </div>
              <div className="p-5">
                <div className="font-heading font-semibold text-[#14110F] leading-snug group-hover:text-[#205040] transition-colors">{nomModele(x)}</div>
                <div className="mt-1 text-sm text-[#78716C]">{x.format}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
