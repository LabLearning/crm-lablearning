import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, Clock, CalendarCheck, CheckCircle2, BookOpen } from '../../icons'
import { Kicker } from '../../Kicker'
import { GuideCorps } from '../../guides/GuideCorps'
import { jsonLd } from '../../jsonld'
import { lienWhatsapp } from '../../whatsapp'
import { articleParSlug, articlesParus, estParu, jourParis } from '@/lib/blog'
import { guideParSlug } from '@/lib/guides'
import { formationsLiees } from '../../formations-liees'
import { titreFormation } from '@/lib/utils'

// Rendu à chaque visite : un article paraît le jour prévu, sans redéploiement
export const dynamic = 'force-dynamic'

const BASE = 'https://www.lab-learning.fr'

const dateFr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

type Props = { params: { slug: string }; searchParams: { apercu?: string } }

/** L'article, s'il est paru, ou s'il attend sa date et qu'on le relit (?apercu=1). */
function lire({ params, searchParams }: Props) {
  const a = articleParSlug(params.slug)
  if (!a) return null
  const paru = estParu(a, jourParis())
  if (!paru && !searchParams?.apercu) return null
  return { a, paru }
}

export async function generateMetadata(props: Props) {
  const lu = lire(props)
  if (!lu) return { title: 'Blog' }
  const { a, paru } = lu
  return {
    title: a.titreCourt,
    description: a.description,
    alternates: { canonical: `/blog/${a.slug}` },
    // Un article qui attend sa date se relit en ligne mais n'entre pas dans les moteurs
    robots: paru ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: a.titre,
      description: a.description,
      url: `/blog/${a.slug}`,
      publishedTime: a.publieLe,
      modifiedTime: a.majLe,
      section: a.categorie,
      images: [{ url: a.image, alt: a.imageAlt }],
    },
  }
}

export default async function SiteArticle(props: Props) {
  const lu = lire(props)
  if (!lu) notFound()
  const { a, paru } = lu
  const [liees] = await Promise.all([formationsLiees(a.formations)])
  const guides = a.guides.map((s) => guideParSlug(s)).filter((g): g is NonNullable<typeof g> => !!g && g.publie)
  // À lire aussi : d'abord le même thème, toujours parmi les articles parus
  const parus = articlesParus().filter((x) => x.slug !== a.slug)
  const autres = [...parus.filter((x) => x.categorie === a.categorie), ...parus.filter((x) => x.categorie !== a.categorie)].slice(0, 3)

  const sommaire = (
    <nav aria-label="Sommaire" className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
      <div className="font-heading text-sm font-bold uppercase tracking-wider text-[#78716C]">Sommaire</div>
      <ol className="mt-3 space-y-1.5 text-[15px]">
        {a.sections.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="inline-flex gap-2 text-[#44403C] hover:text-[#205040] transition-colors">
              <span className="tabular-nums text-[#A8A29E]">{i + 1}.</span>{s.titre}
            </a>
          </li>
        ))}
        {a.faq.length > 0 && (
          <li><a href="#questions" className="inline-flex gap-2 text-[#44403C] hover:text-[#205040] transition-colors"><span className="tabular-nums text-[#A8A29E]">{a.sections.length + 1}.</span>Questions fréquentes</a></li>
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
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog` },
        { '@type': 'ListItem', position: 3, name: a.titre },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: a.titre,
      description: a.description,
      image: `${BASE}${a.image}`,
      datePublished: a.publieLe,
      dateModified: a.majLe,
      author: { '@id': `${BASE}/#organization` },
      publisher: { '@id': `${BASE}/#organization` },
      mainEntityOfPage: `${BASE}/blog/${a.slug}`,
      articleSection: a.categorie,
      inLanguage: 'fr-FR',
    },
    ...(a.faq.length ? [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
    }] : []),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      {!paru && (
        <div className="bg-[#FEF3E2] border-b border-[#EA580C]/20 px-5 py-3 text-center text-sm text-[#7C2D12]">
          Relecture : cet article paraîtra le {dateFr(a.publieLe)}. Il n&apos;est ni publié ni référencé d&apos;ici là.
        </div>
      )}

      <article>
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 ll-grid-faint" />
          <div className="max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-10">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[#57534E] hover:text-[#205040] transition-colors">
              <ArrowLeft className="h-4 w-4" /> Tous les articles
            </Link>
            <div className="mt-6"><Kicker>{a.categorie}</Kicker></div>
            <h1 className="mt-3 ll-display ll-fluid-h1 text-[#14110F] text-balance max-w-4xl">{a.titre}</h1>
            <p className="mt-5 text-lg md:text-xl text-[#57534E] leading-relaxed max-w-3xl">{a.chapeau}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#78716C]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4" />Publié le <time dateTime={a.publieLe}>{dateFr(a.publieLe)}</time>
                {a.majLe > a.publieLe && <>, mis à jour le <time dateTime={a.majLe}>{dateFr(a.majLe)}</time></>}
              </span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{a.lecture} min de lecture</span>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <img src={a.image} alt={a.imageAlt} width={1600} height={900} className="aspect-[16/9] lg:aspect-[21/9] w-full rounded-3xl object-cover ring-1 ring-black/5" />
        </div>

        {/* Sur grand écran : le texte à gauche, le sommaire et les guides liés à droite, qui suivent la lecture */}
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <div className="min-w-0">
            {a.aRetenir.length > 0 && (
              <aside className="rounded-3xl bg-[#205040] text-white p-6 md:p-7">
                <div className="font-heading font-bold text-lg">À retenir</div>
                <ul className="mt-3 space-y-2.5">
                  {a.aRetenir.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-white/90">
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#5CD9A0]" /><span>{p}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            <div className="mt-8 lg:hidden">{sommaire}</div>

            <div className="mt-12">
              <GuideCorps sections={a.sections} />
            </div>

            {a.faq.length > 0 && (
              <section id="questions" className="mt-12 scroll-mt-24">
                <h2 className="ll-display text-2xl md:text-[1.9rem] text-[#14110F]">Questions fréquentes</h2>
                <div className="mt-5 space-y-3">
                  {a.faq.map((f) => (
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

            {a.sources.length > 0 && (
              <section className="mt-12">
                <h2 className="font-heading text-lg font-bold text-[#14110F]">Sources officielles</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {a.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#205040] underline decoration-[#205040]/30 underline-offset-2 hover:decoration-[#205040]">{s.libelle}</a>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-[#78716C]">
                  Cet article donne une information générale, à jour au {dateFr(a.majLe)}. Il ne remplace pas la lecture des textes cités ni un conseil adapté à votre situation.
                </p>
              </section>
            )}

            {guides.length > 0 && (
              <aside className="mt-12 rounded-3xl bg-[#F6F4EF] p-5 md:p-6 lg:hidden">
                <div className="font-heading text-lg font-bold text-[#14110F]">Pour aller plus loin</div>
                <div className="mt-4 space-y-3">
                  {guides.map((g) => (
                    <Link key={g.slug} href={`/guides/${g.slug}`} className="group flex items-center gap-4 rounded-2xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-3 pr-4 ll-lift">
                      <img loading="lazy" src={g.image} alt="" className="w-24 sm:w-32 shrink-0 aspect-[16/9] rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 font-heading font-semibold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{g.titre}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#205040]" />
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-5">
              {sommaire}
              {guides.length > 0 && (
                <div className="rounded-2xl bg-[#F6F4EF] p-5">
                  <div className="font-heading text-sm font-bold uppercase tracking-wider text-[#78716C]">Pour aller plus loin</div>
                  <div className="mt-3 space-y-2.5">
                    {guides.map((g) => (
                      <Link key={g.slug} href={`/guides/${g.slug}`} className="group flex items-start gap-3 rounded-xl bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 p-3 ll-lift">
                        <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-[#205040]" />
                        <span className="min-w-0 flex-1 font-heading text-sm font-semibold leading-snug text-[#14110F] group-hover:text-[#205040] transition-colors">{g.titre}</span>
                      </Link>
                    ))}
                  </div>
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
            <a href={lienWhatsapp(`Bonjour, j'ai une question après avoir lu votre article « ${a.titre} ».`)} target="_blank" rel="noopener noreferrer"
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
              <Link key={x.slug} href={`/blog/${x.slug}`} className="group flex flex-col rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 ll-lift">
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
