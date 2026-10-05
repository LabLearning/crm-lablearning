import Link from 'next/link'
import { ArrowRight, Banknote, CheckCircle2, FileCheck2, PhoneCall, GraduationCap } from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'

export const metadata = {
  title: 'Financement formation : OPCO, AGEFICE, CPF',
  description:
    'OPCO, AGEFICE, CPF : les dispositifs qui financent vos formations professionnelles. On vous accompagne pour que chaque formation soit prise en charge.',
  alternates: { canonical: '/financements' },
}

/*
 * Wording : Lab Learning FORME et ACCOMPAGNE la démarche de prise en charge.
 * Ne jamais écrire que nous faisons les démarches à la place du client
 * (dépôt de dossier, mandat...) : c'est toujours « on vous aide / on vous
 * accompagne / on prépare avec vous ».
 */
interface Dispositif {
  t: string
  sous: string
  pourQui: string
  d: string
  points: string[]
  logos: { src: string; alt: string }[]
  photo: string
  href?: string
  cta?: string
}

const OPCO: Dispositif = {
  t: 'Plan de développement des compétences',
  sous: 'Votre OPCO de branche',
  pourQui: 'Salariés en poste',
  d: 'Votre opérateur de compétences finance tout ou partie de la formation de vos salariés : AKTO, OPCO EP, L’Opcommerce et les autres OPCO de branche. Nos tarifs sont calés sur leurs barèmes, le reste à charge est souvent nul.',
  points: ['AKTO, OPCO EP, L’Opcommerce et d’autres', 'Formations pendant l’exploitation', 'Reste à charge souvent nul'],
  logos: [
    { src: '/site/logos/financeurs/akto.png', alt: 'AKTO' },
    { src: '/site/logos/financeurs/opco-ep.svg', alt: 'OPCO EP' },
    { src: '/site/logos/financeurs/opcommerce.svg', alt: "L'Opcommerce" },
  ],
  photo: '/site/metiers/cuisine.webp',
}

const AGEFICE: Dispositif = {
  t: 'AGEFICE',
  sous: 'Dirigeants non salariés',
  pourQui: 'Gérants & indépendants',
  d: 'Gérant non salarié d’un restaurant ou d’un commerce de bouche ? L’AGEFICE rembourse vos formations selon les barèmes en vigueur ; on vous guide à chaque étape de votre demande auprès de votre Point d’Accueil.',
  points: ['Formations obligatoires et métier', 'Accompagnement à chaque étape de la demande', 'Remboursement selon les barèmes en vigueur'],
  logos: [{ src: '/site/logos/financeurs/agefice.png', alt: 'AGEFICE' }],
  photo: '/site/metiers/hcr.webp',
}

const CPF: Dispositif = {
  t: 'CPF',
  sous: 'Mon Compte Formation',
  pourQui: 'Individuel',
  d: 'Chaque actif dispose d’un budget formation attaché à son compte. Notre formation Création d’entreprise est éligible : le CPF finance tout ou partie du parcours, mobilisable directement par le salarié ou le demandeur d’emploi.',
  points: ['Mobilisable depuis votre compte, en quelques clics', 'Formation Création d’entreprise éligible'],
  logos: [{ src: '/site/logos/financeurs/mon-compte-formation.svg', alt: 'Mon Compte Formation' }],
  photo: '/site/metiers/management.webp',
  href: '/formations/d8bcc0e2-80de-4784-b4c8-5bb2e1bf72f8',
  cta: 'Voir la formation éligible',
}

// Financeurs dont les logos sont affichés. Ni France Travail ni la POEI sur le
// site : Lab Learning n'est pas partenaire de France Travail et ne met pas en
// avant ses dispositifs (courrier de France Travail Auvergne-Rhône-Alpes du 30/09/2026).
const FINANCEURS = [
  { src: '/site/logos/financeurs/akto.png', alt: 'AKTO' },
  { src: '/site/logos/financeurs/opco-ep.svg', alt: 'OPCO EP' },
  { src: '/site/logos/financeurs/opcommerce.svg', alt: "L'Opcommerce" },
  { src: '/site/logos/financeurs/mon-compte-formation.svg', alt: 'Mon Compte Formation' },
  { src: '/site/logos/financeurs/agefice.png', alt: 'AGEFICE' },
]

/** Comment on vous accompagne jusqu'à la prise en charge, étape par étape. */
const PARCOURS = [
  { Icon: PhoneCall, t: 'On échange sur votre besoin', d: 'Objectifs, équipe à former, calendrier : un premier point suffit pour cadrer.' },
  { Icon: Banknote, t: 'On identifie le bon dispositif', d: 'OPCO, AGEFICE ou CPF : on repère le financeur et le barème de votre branche.' },
  { Icon: FileCheck2, t: 'On prépare le dossier avec vous', d: 'Programme, devis et convention conformes Qualiopi : tout est prêt pour votre demande de prise en charge.' },
  { Icon: GraduationCap, t: 'On forme, vous êtes pris en charge', d: 'La prise en charge accordée, la session est planifiée et nos formateurs interviennent chez vous.' },
]

function PlaqueLogos({ logos }: { logos: { src: string; alt: string }[] }) {
  if (!logos.length) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {logos.map((l) => (
        <span key={l.alt} className="inline-flex h-14 items-center rounded-xl bg-white ring-1 ring-black/10 shadow-sm px-3">
          <img src={l.src} alt={l.alt} title={l.alt} className="h-9 w-auto max-w-[120px] object-contain" />
        </span>
      ))}
    </div>
  )
}

/** Carte verticale : couverture photo, plaque logo en chevauchement, points. */
function CarteDispositif({ x, delay = 0, className = '' }: { x: Dispositif; delay?: number; className?: string }) {
  return (
    <Reveal delay={delay} className={`h-full ${className}`}>
      <div className="group h-full rounded-3xl border border-[#205040]/10 bg-white overflow-hidden flex flex-col hover:shadow-xl hover:shadow-black/10 hover:border-[#205040]/25 hover:-translate-y-1.5 transition-all duration-300">
        <div className="relative h-36 overflow-hidden">
          <img src={x.photo} alt="" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          <span className="absolute top-3 right-3 text-xs font-semibold text-[#205040] bg-white/95 rounded-full px-3 py-1.5 shadow-sm">{x.pourQui}</span>
        </div>
        <div className="px-6 relative z-10 -mt-7">
          <PlaqueLogos logos={x.logos} />
        </div>
        <div className="px-6 pt-4 pb-6 flex flex-col flex-1">
          <div className="font-heading font-bold text-lg text-[#14110F]">{x.t}</div>
          <div className="mt-0.5 text-xs font-semibold text-[#22A972]">{x.sous}</div>
          <p className="mt-2.5 text-sm text-[#57534E] leading-relaxed">{x.d}</p>
          <ul className="mt-3 space-y-1.5 flex-1">
            {x.points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-[#44403C]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#205040]" /> {p}
              </li>
            ))}
          </ul>
          <Link href={x.href || '/contact'} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
            {x.cta || 'Étudier ce dispositif'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Reveal>
  )
}

/** Carte horizontale pleine largeur : la photo d'un côté, le contenu de l'autre. */
function CarteHorizontale({ x, imageADroite = true, delay = 0 }: { x: Dispositif; imageADroite?: boolean; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="group rounded-3xl border border-[#205040]/10 bg-white overflow-hidden grid md:grid-cols-2 hover:shadow-xl hover:shadow-black/10 hover:border-[#205040]/25 transition-all duration-300">
        <div className={`relative h-52 md:h-auto overflow-hidden order-first ${imageADroite ? 'md:order-last' : ''}`}>
          <img src={x.photo} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
          <div className={`absolute inset-0 bg-gradient-to-t ${imageADroite ? 'md:bg-gradient-to-r' : 'md:bg-gradient-to-l'} from-black/25 via-transparent to-transparent`} />
        </div>
        <div className="p-6 md:p-10 flex flex-col">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <PlaqueLogos logos={x.logos} />
            <span className="text-xs font-semibold text-[#205040] bg-[#205040]/8 rounded-full px-3 py-1.5">{x.pourQui}</span>
          </div>
          <div className="mt-5 font-heading font-bold text-2xl text-[#14110F]">{x.t}</div>
          <div className="mt-0.5 text-sm font-semibold text-[#22A972]">{x.sous}</div>
          <p className="mt-3 text-[#57534E] leading-relaxed">{x.d}</p>
          <ul className="mt-4 space-y-2">
            {x.points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-[#44403C]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#205040]" /> {p}
              </li>
            ))}
          </ul>
          <Link href={x.href || '/contact'} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
            {x.cta || 'Étudier ce dispositif'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Reveal>
  )
}

export default function SiteFinancements() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-12">
          <Kicker className="mb-5"><Banknote className="h-4 w-4" /> Financements</Kicker>
          <h1 className="ll-display ll-fluid-hero text-[#14110F] text-balance">
            Vos formations, <span className="text-[#205040]">financées</span>.
          </h1>
          <p className="mt-7 text-lg md:text-xl text-[#57534E] leading-relaxed max-w-2xl">
            Salariés en poste, dirigeants, projets personnels : il existe un dispositif pour chaque situation.
            On identifie le bon financeur et on vous accompagne pour que votre formation soit prise en charge.
          </p>
          {/* Le mur des financeurs : la preuve avant l'argumentaire */}
          <div className="mt-10 flex flex-wrap items-center gap-3">
            {FINANCEURS.map((l, i) => (
              <Reveal key={l.alt} delay={i * 70}>
                <span className="inline-flex h-16 items-center rounded-2xl bg-white ring-1 ring-black/5 shadow-sm px-5 hover:ring-[#205040]/25 hover:shadow-md transition-all">
                  <img src={l.src} alt={l.alt} title={l.alt} className="h-10 w-auto max-w-[140px] object-contain" />
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Les types de financement possibles ──
          Rythme : OPCO en vedette, puis AGEFICE et CPF côte à côte. */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <Kicker className="mb-4">Les dispositifs</Kicker>
        <h2 className="ll-display ll-fluid-h2 text-[#14110F] mb-10">Les types de financement possibles</h2>

        <CarteHorizontale x={OPCO} />

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <CarteDispositif x={AGEFICE} delay={80} />
          <CarteDispositif x={CPF} delay={160} />
        </div>
      </section>

      {/* ── L'accompagnement : le parcours animé, étape après étape ── */}
      <section className="bg-[#FAFAFA] border-y border-[#205040]/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-20 grid lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <Kicker className="mb-4">Accompagnement complet</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">On fait en sorte que ce soit pris en charge</h2>
            <p className="mt-4 text-[#57534E] leading-relaxed">
              Nous formons vos équipes, et on vous accompagne dans votre démarche de prise en charge :
              le bon dispositif, les bons documents, au bon moment. Voilà comment ça se passe, dans l&apos;ordre.
            </p>
            <Link href="/contact" className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#205040] text-white text-sm font-semibold hover:bg-[#123f34] ll-lift">
              Lancer la première étape <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {/* Timeline verticale : chaque étape se révèle en cascade, la ligne se dessine avec elle */}
          <div className="lg:col-span-7">
            {PARCOURS.map((e, i) => (
              <Reveal key={e.t} delay={i * 180}>
                <div className="group relative flex gap-5 pb-2">
                  {/* Rail : pastille icône + segment de ligne qui se dessine */}
                  <div className="flex flex-col items-center">
                    <span className="relative z-10 h-12 w-12 shrink-0 rounded-2xl bg-white ring-1 ring-[#205040]/15 shadow-sm flex items-center justify-center text-[#205040] transition-all duration-300 group-hover:bg-[#205040] group-hover:text-white group-hover:scale-110 group-hover:rotate-3">
                      <e.Icon className="h-5 w-5" />
                    </span>
                    {i < PARCOURS.length - 1 && (
                      <span className="ll-step-line w-px flex-1 my-1 bg-gradient-to-b from-[#38C588] to-[#205040]/20" style={{ transitionDelay: `${i * 180 + 220}ms` }} />
                    )}
                  </div>
                  <div className={i < PARCOURS.length - 1 ? 'pb-8' : ''}>
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-heading font-black text-sm text-[#38C588] tabular-nums">0{i + 1}</span>
                      <span className="font-heading font-semibold text-lg text-[#14110F]">{e.t}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed max-w-md">{e.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="rounded-[28px] bg-[#205040] text-white px-6 md:px-14 py-14 md:flex items-center justify-between gap-8">
          <div>
            <h2 className="ll-display text-2xl md:text-4xl text-balance text-white">Faites prendre en charge vos formations</h2>
            <p className="mt-3 text-white/70 max-w-xl">Dites-nous qui former et pour quel objectif : on vous accompagne à chaque étape.</p>
          </div>
          <Link href="/contact" className="mt-6 md:mt-0 shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#205040] text-sm font-semibold hover:bg-[#F6F4EF] transition-colors">
            Étudier mon financement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
