import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, Clock, Monitor, CheckCircle2, ShieldCheck, Banknote } from '../../icons'
import { getBranchesData } from '@/lib/public-site-data'
import { brancheBySlug, BRANCHES } from '../../branches'
import { MetierVisual } from '../../MetierVisual'
import { Reveal } from '../../Reveal'
import { titreFormation } from '@/lib/utils'
import { metierStyle } from '../../metier'
import { photoFormation } from '@/lib/formations-photos'
import { altFormation } from '../../alt'
import { jsonLd } from '../../jsonld'

export const dynamic = 'force-dynamic'

const MODALITE: Record<string, string> = { presentiel: 'Présentiel', distanciel: 'À distance', mixte: 'Mixte' }

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const b = brancheBySlug(params.slug)
  if (!b) return { title: 'Formations' }
  return {
    title: `Formations ${b.label}`,
    description: `Formations ${b.label} en établissement, partout en France. ${b.tagline}. Certifié Qualiopi, éligible OPCO.`,
    alternates: { canonical: `/branches/${b.slug}` },
  }
}

export default async function SiteBranche({ params }: { params: { slug: string } }) {
  const b = brancheBySlug(params.slug)
  if (!b) notFound()
  const data = await getBranchesData()
  const branche = data.find((d) => d.slug === params.slug)
  const groups = branche?.groups || []
  const autres = BRANCHES.filter((x) => x.slug !== b.slug)

  // Fil d'Ariane et liste des formations de la branche, balisés pour les moteurs
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.lab-learning.fr/' },
        { '@type': 'ListItem', position: 2, name: 'Formations', item: 'https://www.lab-learning.fr/formations' },
        { '@type': 'ListItem', position: 3, name: `Formations ${b.label}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Formations ${b.label}`,
      itemListElement: groups.flatMap((g) => g.formations).map((f, i) => ({
        '@type': 'ListItem', position: i + 1, name: titreFormation(f.intitule), url: `https://www.lab-learning.fr/formations/${f.id}`,
      })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      {/* Hero métier */}
      <section className="relative overflow-hidden border-b border-[#205040]/10">
        <img src={`/site/metiers/${b.img}.webp`} alt={`Formation ${b.label.toLowerCase()}`} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(120deg, ${b.from}E6 0%, ${b.to}B3 55%, rgba(0,0,0,0.55) 100%)` }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-14 md:pb-20 text-white">
          <Link href="/formations" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Tous les métiers
          </Link>
          <div className="mt-6"><span className="ll-kicker ll-kicker--light">Vous êtes</span></div>
          <h1 className="mt-2 ll-display ll-fluid-hero text-balance text-white">{b.label}</h1>
          <p className="mt-4 text-lg md:text-xl text-white/85 max-w-2xl">{b.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm"><CheckCircle2 className="h-4 w-4" />{branche?.total || 0} formations pour vous</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm"><ShieldCheck className="h-4 w-4" />Certifié Qualiopi</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur-sm"><Banknote className="h-4 w-4" />Éligible OPCO</span>
          </div>
        </div>
      </section>

      {/* Formations groupées par thème */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-16 space-y-14">
        {groups.length === 0 && (
          <div className="rounded-2xl border border-[#205040]/10 bg-white p-10 text-center text-[#78716C]">
            Le catalogue de ce métier arrive très bientôt. <Link href="/contact" className="font-semibold text-[#205040]">Contactez-nous</Link>.
          </div>
        )}
        {groups.map((g) => (
          <section key={g.key}>
            <div className="flex items-baseline justify-between gap-4 border-b border-[#205040]/10 pb-3 mb-6">
              <h2 className="ll-display text-2xl md:text-3xl text-[#14110F]">{g.label}</h2>
              <span className="text-sm text-[#A8A29E] shrink-0 tabular-nums">{g.formations.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {g.formations.map((f, i) => (
                <Reveal key={f.id} delay={(i % 3) * 70}>
                  <Link href={`/formations/${f.id}`} className="group h-full flex flex-col rounded-2xl border border-[#205040]/10 bg-white overflow-hidden hover:border-[#205040]/30 hover:shadow-sm ll-lift">
                    <div className="relative h-32 overflow-hidden">
                      {/* La photo suit le THÈME de la formation, pas le groupe :
                          hygiène, sécurité, management... chacune la sienne. */}
                      {(() => {
                        const st = metierStyle(f.intitule)
                        return (
                          <>
                            <img loading="lazy" src={photoFormation(f.id) || st.img} alt={altFormation(titreFormation(f.intitule))} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${st.from}26 0%, ${st.to}73 100%)` }} />
                          </>
                        )
                      })()}
                    </div>
                    <div className="flex flex-col flex-1 p-5">
                      <div className="font-heading font-semibold text-[#14110F] leading-snug group-hover:text-[#205040] transition-colors">{titreFormation(f.intitule)}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#78716C]">
                        {f.duree_heures ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{f.duree_heures} h</span> : null}
                        {f.modalite ? <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />{MODALITE[f.modalite] || f.modalite}</span> : null}
                        {/* Le prix dès la carte : calé sur la prise en charge OPCO. */}
                        {f.tarif_inter_ht ? (
                          <span className="font-semibold text-[#205040]">{Number(f.tarif_inter_ht).toLocaleString('fr-FR')} € HT/pers.</span>
                        ) : f.tarif_intra_ht ? (
                          <span className="font-semibold text-[#205040]">{Number(f.tarif_intra_ht).toLocaleString('fr-FR')} € HT/groupe</span>
                        ) : null}
                      </div>
                      {f.objectifs.length > 0 && (
                        <ul className="mt-4 space-y-1.5 flex-1">
                          {f.objectifs.slice(0, 3).map((o, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-[#57534E]">
                              <CheckCircle2 className="h-4 w-4 text-[#205040] shrink-0 mt-0.5" /><span className="line-clamp-2">{o}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] group-hover:gap-2.5 transition-all">
                        Voir le programme <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Autres métiers */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <div className="mb-5"><span className="ll-kicker">Autres métiers</span></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {autres.map((x) => (
            <Link key={x.slug} href={`/branches/${x.slug}`} className="group rounded-2xl overflow-hidden ring-1 ring-black/5 hover:ring-[#205040]/25 ll-lift">
              <MetierVisual nom={x.label} label={x.label} height="h-28" />
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
        <div className="rounded-[28px] bg-[#205040] text-white px-6 md:px-14 py-14 md:flex items-center justify-between gap-8">
          <div>
            <h2 className="ll-display text-2xl md:text-4xl text-balance text-white">Un besoin précis pour votre équipe ?</h2>
            <p className="mt-3 text-white/70 max-w-xl">On construit le parcours et on vous accompagne dans la prise en charge par votre OPCO.</p>
          </div>
          <Link href="/contact" className="mt-6 md:mt-0 shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#205040] text-sm font-semibold hover:bg-[#F6F4EF] ll-lift">
            Demander un devis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
