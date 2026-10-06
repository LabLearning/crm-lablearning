import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, Clock, CalendarCheck, CheckCircle2, BookOpen, Download } from '../../icons'
import { Kicker } from '../../Kicker'
import { GuideCorps } from '../GuideCorps'
import { jsonLd } from '../../jsonld'
import { lienWhatsapp } from '../../whatsapp'
import { guideParSlug, guidesPublies } from '@/lib/guides'
import { formationsLiees } from '../../formations-liees'
import { modelesDuGuide, apercuModele, nomModele, formatModele } from '@/lib/modeles'
import { titreFormation } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

const dateFr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const g = guideParSlug(params.slug)
  if (!g) return { title: 'Guide' }
  return {
    title: g.titreCourt,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    // Un brouillon se relit en ligne mais ne doit pas entrer dans les moteurs
    robots: g.publie ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: g.titre,
      description: g.description,
      url: `/guides/${g.slug}`,
      publishedTime: g.publieLe,
      modifiedTime: g.majLe,
      images: [{ url: g.image, alt: g.imageAlt }],
    },
  }
}

export default async function SiteGuide({ params }: { params: { slug: string } }) {
  const g = guideParSlug(params.slug)
  if (!g) notFound()
  const [liees] = await Promise.all([formationsLiees(g.formations)])
  const autres = guidesPublies().filter((x) => x.slug !== g.slug).slice(0, 3)
  const modeles = modelesDuGuide(g.slug)
  const sommaire = (
    <nav aria-label="Sommaire" className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
      <div className="font-heading text-sm font-bold uppercase tracking-wider text-[#78716C]">Sommaire</div>
      <ol className="mt-3 space-y-1.5 text-[15px]">
        {g.sections.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="inline-flex gap-2 text-[#44403C] hover:text-[#205040] transition-colors">
              <span className="tabular-nums text-[#A8A29E]">{i + 1}.</span>{s.titre}
            </a>
          </li>
        ))}
        {g.faq.length > 0 && (
          <li><a href="#questions" className="inline-flex gap-2 text-[#44403C] hover:text-[#205040] transition-colors"><span className="tabular-nums text-[#A8A29E]">{g.sections.length + 1}.</span>Questions fréquentes</a></li>
        )}
      </ol>
    </nav>
  )

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${BASE}/guides` },
        { '@type': 'ListItem', position: 3, name: g.titre },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.titre,
      description: g.description,
      image: `${BASE}${g.image}`,
      datePublished: g.publieLe,
      dateModified: g.majLe,
      author: { '@id': `${BASE}/#organization` },
      publisher: { '@id': `${BASE}/#organization` },
      mainEntityOfPage: `${BASE}/guides/${g.slug}`,
      articleSection: g.categorie,
    },
    ...(g.faq.length ? [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: g.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
    }] : []),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      {!g.publie && (
        <div className="bg-[#FEF3E2] border-b border-[#EA580C]/20 px-5 py-3 text-center text-sm text-[#7C2D12]">
          Brouillon en relecture : cette page n&apos;est ni publiée ni référencée.
        </div>
      )}

      <article>
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 ll-grid-faint" />
          <div className="max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-10">
            <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-[#57534E] hover:text-[#205040] transition-colors">
              <ArrowLeft className="h-4 w-4" /> Tous les guides
            </Link>
            <div className="mt-6"><Kicker>{g.categorie}</Kicker></div>
            <h1 className="mt-3 ll-display ll-fluid-h1 text-[#14110F] text-balance max-w-4xl">{g.titre}</h1>
            <p className="mt-5 text-lg md:text-xl text-[#57534E] leading-relaxed max-w-3xl">{g.chapeau}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#78716C]">
              <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4" />Mis à jour le {dateFr(g.majLe)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{g.lecture} min de lecture</span>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <img src={g.image} alt={g.imageAlt} width={1600} height={900} className="aspect-[16/9] lg:aspect-[21/9] w-full rounded-3xl object-cover ring-1 ring-black/5" />
        </div>

        {/* Sur grand écran : le texte à gauche, le sommaire et les modèles à droite, qui suivent la lecture */}
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <div className="min-w-0">
          {g.aRetenir.length > 0 && (
            <aside className="rounded-3xl bg-[#205040] text-white p-6 md:p-7">
              <div className="font-heading font-bold text-lg">À retenir</div>
              <ul className="mt-3 space-y-2.5">
                {g.aRetenir.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-white/90">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#5CD9A0]" /><span>{p}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="mt-8 lg:hidden">{sommaire}</div>

          <div className="mt-12">
            <GuideCorps sections={g.sections} />
          </div>

          {modeles.length > 0 && (
            <aside className="mt-12 rounded-3xl bg-[#F6F4EF] p-5 md:p-6 lg:hidden">
              <div className="font-heading text-lg font-bold text-[#14110F]">{modeles.length > 1 ? 'Modèles gratuits à imprimer' : 'Modèle gratuit à imprimer'}</div>
              <div className="mt-4 space-y-3">
                {modeles.map((m) => (
                  <Link key={m.slug} href={`/modeles/${m.slug}`} className="group flex items-center gap-4 rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-3 pr-4 ll-lift">
                    <img loading="lazy" src={apercuModele(m.slug)} alt="" width={1287} height={910} className="w-24 sm:w-32 shrink-0 rounded-lg ring-1 ring-black/10" />
                    <div className="min-w-0 flex-1">
                      <div className="font-heading font-semibold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{nomModele(m)}</div>
                      <div className="mt-0.5 text-sm text-[#78716C]">{formatModele(m)}</div>
                    </div>
                    <span className="shrink-0 h-9 w-9 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] group-hover:bg-[#205040] group-hover:text-white transition-colors">
                      <Download className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </aside>
          )}

          {g.faq.length > 0 && (
            <section id="questions" className="mt-12 scroll-mt-24">
              <h2 className="ll-display text-2xl md:text-[1.9rem] text-[#14110F]">Questions fréquentes</h2>
              <div className="mt-5 space-y-3">
                {g.faq.map((f) => (
                  <details key={f.q} className="group rounded-2xl bg-white ring-1 ring-black/5 open:ring-[#205040]/20">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4">
                      <span className="font-heading font-semibold text-[#14110F]">{f.q}</span>
                      <span className="shrink-0 h-8 w-8 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] transition-transform group-open:rotate-90"><ArrowRight className="h-4 w-4" /></span>
                    </summary>
                    <div className="px-5 pb-5 -mt-1 text-[15px] text-[#57534E] leading-relaxed">{f.r}</div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {g.sources.length > 0 && (
            <section className="mt-12">
              <h2 className="font-heading text-lg font-bold text-[#14110F]">Sources officielles</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {g.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#205040] underline decoration-[#205040]/30 underline-offset-2 hover:decoration-[#205040]">{s.libelle}</a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-[#78716C]">
                Ce guide donne une information générale, à jour au {dateFr(g.majLe)}. Il ne remplace pas la lecture des textes cités ni un conseil adapté à votre situation.
              </p>
            </section>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-5">
            {sommaire}
            {modeles.length > 0 && (
              <div className="rounded-2xl bg-[#F6F4EF] p-5">
                <div className="font-heading text-sm font-bold uppercase tracking-wider text-[#78716C]">{modeles.length > 1 ? 'Modèles gratuits' : 'Modèle gratuit'}</div>
                <div className="mt-3 space-y-2.5">
                  {modeles.slice(0, 4).map((m) => (
                    <Link key={m.slug} href={`/modeles/${m.slug}`} className="group flex items-center gap-3 rounded-xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-2.5 pr-3 ll-lift">
                      <img loading="lazy" src={apercuModele(m.slug)} alt="" width={1287} height={910} className="w-20 shrink-0 rounded-md ring-1 ring-black/10" />
                      <span className="min-w-0 flex-1 font-heading text-sm font-semibold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{nomModele(m)}</span>
                      <Download className="h-4 w-4 shrink-0 text-[#205040]" />
                    </Link>
                  ))}
                </div>
                {modeles.length > 4 && (
                  <Link href="/modeles" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
                    Tous les modèles <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}
            <div className="rounded-2xl bg-[#205040] p-5 text-white">
              <div className="font-heading font-bold">Une question sur votre établissement ?</div>
              <p className="mt-1.5 text-sm text-white/85 leading-relaxed">Nous regardons avec vous ce qui s&apos;applique à votre équipe.</p>
              <Link href="/contact" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#205040] hover:bg-white/90 transition-colors">
                Nous contacter <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </aside>
        </div>
      </article>

      {liees.length > 0 && (
        <section className="bg-[#F6F4EF]">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-14">
            <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">Nos formations sur ce sujet</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {liees.map((f: any) => (
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

      <section className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="rounded-3xl bg-[#205040] text-white p-7 md:p-10">
          <h2 className="ll-display text-2xl md:text-3xl text-white">Une question sur votre établissement ?</h2>
          <p className="mt-3 text-white/85 max-w-2xl">Dites-nous où vous en êtes : nous regardons avec vous ce qui s&apos;applique à votre équipe et comment organiser la formation.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#205040] hover:bg-white/90 transition-colors">
              Nous contacter <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={lienWhatsapp(`Bonjour, j'ai une question après avoir lu votre guide « ${g.titre} ».`)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full ring-1 ring-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Nous écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      {autres.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
          <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">À lire aussi</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {autres.map((x) => (
              <Link key={x.slug} href={`/guides/${x.slug}`} className="group flex flex-col rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 ll-lift">
                <img loading="lazy" src={x.image} alt={x.imageAlt} className="aspect-[16/9] w-full object-cover" />
                <div className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#205040]">{x.categorie}</div>
                  <div className="mt-1.5 font-heading font-semibold text-[#14110F] leading-snug group-hover:text-[#205040] transition-colors">{x.titre}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
