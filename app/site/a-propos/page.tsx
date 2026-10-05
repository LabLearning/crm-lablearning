import Link from 'next/link'
import { ArrowRight, ShieldCheck, Target, HeartHandshake, Award, MapPin } from '../icons'
import { getPublicSiteData } from '@/lib/public-site-data'
import { Kicker } from '../Kicker'
import { CountUp } from '../CountUp'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'À propos de notre organisme de formation',
  description:
    'Lab Learning, organisme de formation certifié Qualiopi à Montpellier : formateurs praticiens des métiers de bouche, interventions en établissement partout en France.',
  alternates: { canonical: '/a-propos' },
}

const VALEURS = [
  { Icon: Target, t: 'Le geste juste', d: "Une pédagogie ancrée dans le réel du métier : on apprend en faisant, sur les gestes qui comptent en production." },
  { Icon: HeartHandshake, t: 'Proximité', d: "Des formateurs praticiens qui interviennent au plus près de vos équipes et de vos contraintes d'exploitation." },
  { Icon: Award, t: 'Exigence', d: "Des parcours structurés, évalués et certifiés Qualiopi, pensés pour une montée en compétence durable." },
]

export default async function SiteAPropos() {
  const { stats } = await getPublicSiteData()
  const chiffres = [
    { v: stats.formations, l: 'Formations au catalogue' },
    { v: stats.apprenants, l: 'Stagiaires formés' },
    { v: stats.sessionsRealisees, l: 'Sessions réalisées' },
    { v: stats.entreprises, l: 'Entreprises accompagnées' },
  ]

  return (
    <>
      <section className="relative overflow-hidden max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-10">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <Kicker className="mb-5">Qui sommes-nous</Kicker>
        <h1 className="ll-display ll-fluid-hero text-[#14110F] text-balance">
          Former les métiers de bouche à <span className="text-[#205040]">l’excellence du geste</span>.
        </h1>
        <p className="mt-7 text-lg md:text-xl text-[#57534E] leading-relaxed max-w-2xl">
          Lab Learning est un organisme de formation professionnelle certifié Qualiopi, spécialiste
          de la restauration, de la boucherie, de la boulangerie, de la pâtisserie et de l’hôtellerie.
          Notre conviction : la compétence se transmet sur le terrain, par des praticiens, au rythme des équipes.
        </p>

        {/* Mosaïque terrain : trois regards métier, décalés pour le rythme */}
        <div className="mt-10 grid grid-cols-3 gap-3 md:gap-5">
          {[
            '/site/metiers/cuisine.webp',
            '/site/metiers/boulangerie.webp',
            '/site/metiers/boucherie.webp',
          ].map((src, i) => (
            <div key={src} className={`rounded-3xl overflow-hidden ring-1 ring-black/5 shadow-sm h-40 md:h-64 ${i === 1 ? 'translate-y-4 md:translate-y-8' : ''}`}>
              <img loading="lazy" src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-14">
        <div className="rounded-[28px] bg-[#205040] text-white px-6 md:px-14 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 md:divide-x md:divide-white/10">
          {chiffres.map((c, i) => (
            <div key={c.l} className={i > 0 ? 'md:pl-8' : ''}>
              <div className="ll-display text-4xl md:text-[54px] leading-none"><CountUp value={c.v} /></div>
              <div className="mt-2 text-sm text-white/70">{c.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <Kicker className="mb-4">Nos valeurs</Kicker>
        <h2 className="ll-display ll-fluid-h2 text-[#14110F] mb-10">Ce qui nous guide</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {VALEURS.map((v) => (
            <div key={v.t} className="group rounded-2xl border border-[#205040]/10 bg-white p-6 hover:shadow-lg hover:shadow-black/5 hover:border-[#205040]/25 ll-lift">
              <span className="h-11 w-11 rounded-xl bg-[#205040]/8 flex items-center justify-center mb-4"><v.Icon className="h-5 w-5 text-[#205040]" /></span>
              <div className="font-heading font-semibold text-lg text-[#14110F]">{v.t}</div>
              <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-[#205040]/10 bg-white p-8">
            <ShieldCheck className="h-7 w-7 text-[#205040]" />
            <div className="mt-3 font-heading font-bold text-xl text-[#14110F] tracking-heading">Certifiés Qualiopi</div>
            <p className="mt-2 text-[#57534E] leading-relaxed">
              La certification Qualiopi atteste de la qualité de nos processus, de l’analyse du besoin
              à l’évaluation des acquis. C’est aussi la condition d’accès aux financements publics et mutualisés.
            </p>
          </div>
          <div className="rounded-3xl border border-[#205040]/10 bg-white p-8">
            <MapPin className="h-7 w-7 text-[#205040]" />
            <div className="mt-3 font-heading font-bold text-xl text-[#14110F] tracking-heading">Sur tout le territoire</div>
            <p className="mt-2 text-[#57534E] leading-relaxed">
              Nous intervenons en présentiel dans vos établissements comme à distance, et accompagnons
              aussi bien l’indépendant que les réseaux et franchises multi-sites.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20">
        <div className="rounded-[32px] bg-[#14110F] text-white px-6 md:px-14 py-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 -z-0 opacity-70" style={{ background: 'radial-gradient(600px 300px at 20% 0%, rgba(25,81,68,0.5), transparent 60%), radial-gradient(500px 260px at 100% 100%, rgba(99,102,241,0.35), transparent 55%)' }} />
          <div className="relative">
          <h2 className="ll-display ll-fluid-h2 text-balance text-white">Travaillons ensemble</h2>
          <p className="mt-3 text-white/60 max-w-xl mx-auto text-lg">Parlez-nous de vos équipes et de vos objectifs : on construit le parcours.</p>
          <Link href="/contact" className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#14110F] text-sm font-semibold hover:bg-[#F6F4EF] ll-lift">
            Nous contacter <ArrowRight className="h-4 w-4" />
          </Link>
          </div>
        </div>
      </section>
    </>
  )
}
