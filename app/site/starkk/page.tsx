import Link from 'next/link'
import {
  ArrowRight, CheckCircle2, Sparkles, AiChat, AiSecurity,
  UserCheck, Building2, GraduationCap, Calendar, FileCheck2, Clock, ShieldCheck,
} from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { StarkkHero } from './StarkkHero'
import { ChatDemo } from './ChatDemo'
import { ProposerConfirmer } from './ProposerConfirmer'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Starkk, notre intelligence artificielle',
  description:
    'Starkk, l’assistant IA de Lab Learning : il renseigne clients, formateurs et apprenants sur leur espace, retrouve leurs documents, explique et relance.',
  alternates: { canonical: '/starkk' },
}

const CAPACITES = [
  { Icon: AiChat, t: 'Renseigne sur votre compte', d: 'Où en est ma session ? Quand arrive mon attestation ? Qui est mon formateur ? Starkk répond immédiatement, à partir des informations de votre espace.' },
  { Icon: FileCheck2, t: 'Remet le bon document', d: 'Convention, convocation, attestation, certificat de réalisation : chacun retrouve ses documents en une demande, sans fouiller ses emails.' },
  { Icon: GraduationCap, t: 'Aide à comprendre', d: 'Une question de quiz ratée ? Starkk reprend la notion avec l’apprenant, explique la bonne réponse et vérifie qu’elle est comprise.' },
  { Icon: Calendar, t: 'Relance à votre place', d: 'Questionnaires de satisfaction non répondus, émargements en attente, signatures manquantes : Starkk propose les relances, vous validez, il s’en charge.' },
  { Icon: Clock, t: 'Disponible en continu', d: 'Le soir après le service ou le dimanche matin : Starkk répond quand vous travaillez, pas seulement aux heures de bureau.' },
  { Icon: AiSecurity, t: 'Jamais sans votre accord', d: 'Starkk propose, vous confirmez. Aucun envoi, aucune modification sans validation. Chacun n’accède qu’aux informations de son propre espace.' },
]

const PUBLICS = [
  {
    Icon: Building2, badge: 'Clients et gérants', titre: 'Votre espace, sans les allers-retours',
    points: [
      'L’état de votre compte en une question : sessions, conventions, factures, financement OPCO',
      'Les documents de vos salariés remis instantanément',
      'Les démarches en cours suivies et relancées au bon moment',
    ],
  },
  {
    Icon: UserCheck, badge: 'Formateurs', titre: 'Tout votre niveau d’information, sans chercher',
    points: [
      'Vos documents et les infos de vos interventions : planning, lieux, effectifs, grilles',
      'Un appui pédagogique : il aide un apprenant à comprendre une question où il a répondu faux',
      'Les questionnaires de satisfaction et les émargements relancés pour vous',
    ],
  },
  {
    Icon: GraduationCap, badge: 'Apprenants', titre: 'Un accompagnement à portée de main',
    points: [
      'Vos convocations, horaires, lieux et attestations en une demande',
      'Une explication claire quand une question de quiz vous a échappé',
      'Une réponse simple à chaque question sur votre parcours',
    ],
  },
]

const kickerSombre = (label: string) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-[#5CD9A0]/10 ring-1 ring-[#5CD9A0]/25 px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase text-[#5CD9A0]">
    <Sparkles className="h-3.5 w-3.5" /> {label}
  </span>
)

export default function SiteStarkk() {
  return (
    <>
      {/* ── HERO (sombre) ── */}
      <section className="relative overflow-hidden bg-[#0C1210] text-white">
        <div className="absolute inset-0 -z-0 opacity-80" style={{ background: 'radial-gradient(900px 500px at 15% -10%, rgba(92,217,160,0.20), transparent 60%), radial-gradient(700px 400px at 100% 10%, rgba(56,197,136,0.12), transparent 55%)' }} />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 ll-rise">
            {kickerSombre('Notre intelligence artificielle')}
            <h1 className="mt-6 ll-display ll-fluid-hero text-white text-balance">
              Voici <span className="italic inline-block bg-gradient-to-r from-[#5CD9A0] to-[#38C588] bg-clip-text text-transparent px-2 -mx-2 pb-3 -mb-3">Starkk</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              L’assistant IA de Lab Learning simplifie votre espace au maximum : une information sur
              votre compte, un document, une explication, une relance. Vous demandez, il s’en occupe.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#5CD9A0] text-[#0C1210] text-sm font-semibold hover:bg-[#38C588] ll-lift">
                Découvrir Starkk <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/formations" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                Nos formations
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#5CD9A0]" /> Pour nos clients, formateurs et apprenants</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#5CD9A0]" /> Directement dans votre espace</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#5CD9A0]" /> Déjà là pour répondre à vos questions : la bulle en bas à droite</span>
            </div>
          </div>
          <div className="lg:col-span-6 ll-rise" style={{ animationDelay: '0.12s' }}>
            <StarkkHero />
          </div>
        </div>
      </section>

      {/* ── CE QU'IL FAIT (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Ce que Starkk sait faire</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Il simplifie tout ce qui vous fait perdre du temps</h2>
          <p className="mt-4 text-lg text-[#57534E]">
            Starkk n’est pas un chatbot générique : il est branché sur votre espace Lab Learning
            et répond à partir de vos informations réelles, en toute confidentialité.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPACITES.map((c, i) => (
            <Reveal key={c.t} delay={(i % 3) * 80}>
              <div className="group h-full rounded-2xl border border-[#205040]/10 bg-white p-6 hover:shadow-lg hover:shadow-black/5 hover:border-[#205040]/25 ll-lift">
                <span className="h-11 w-11 rounded-xl bg-[#205040]/8 flex items-center justify-center mb-4 group-hover:bg-[#205040] transition-colors">
                  <c.Icon className="h-5 w-5 text-[#205040] group-hover:text-white transition-colors" />
                </span>
                <div className="font-heading font-semibold text-[#14110F]">{c.t}</div>
                <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── DÉMO INTERACTIVE (clair, fenêtre sombre) ── */}
      <section className="bg-[#FAFAFA] border-y border-[#205040]/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <Kicker className="mb-4">Essayez par vous-même</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Posez-lui une question, là, maintenant</h2>
            <p className="mt-4 text-lg text-[#57534E] leading-relaxed">
              Une démonstration avec des données fictives, mais des réponses fidèles à ce que Starkk
              fait au quotidien : renseigner, remettre un document, expliquer, proposer une relance.
            </p>
            <p className="mt-3 text-sm text-[#78716C]">
              Dans votre espace, Starkk répondra avec vos vraies informations.
            </p>
          </div>
          <div className="lg:col-span-7">
            <Reveal><ChatDemo /></Reveal>
          </div>
        </div>
      </section>

      {/* ── POUR QUI (sombre) ── */}
      <section className="relative overflow-hidden bg-[#0C1210] text-white">
        <div className="absolute inset-0 -z-0 opacity-70" style={{ background: 'radial-gradient(700px 400px at 85% 0%, rgba(92,217,160,0.12), transparent 55%), radial-gradient(600px 350px at 0% 100%, rgba(56,197,136,0.10), transparent 55%)' }} />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="max-w-2xl">
            {kickerSombre('Pour qui')}
            <h2 className="mt-5 ll-display ll-fluid-h2 text-white text-balance">Un même assistant, trois espaces</h2>
            <p className="mt-4 text-lg text-white/60">
              Client, formateur ou apprenant : chacun a son espace, et Starkk y répond avec
              le bon niveau d’information. Il aide chacun là où il en a besoin.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PUBLICS.map((p) => (
              <div key={p.badge} className="h-full flex flex-col rounded-3xl bg-white/[0.04] ring-1 ring-white/10 hover:ring-[#5CD9A0]/40 hover:shadow-[0_0_50px_-15px_rgba(92,217,160,0.4)] transition-all">
                <div className="px-6 pt-6 pb-2">
                  <span className="h-10 w-10 rounded-xl bg-[#5CD9A0]/12 ring-1 ring-[#5CD9A0]/25 flex items-center justify-center mb-4"><p.Icon className="h-5 w-5 text-[#5CD9A0]" /></span>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#5CD9A0]">{p.badge}</div>
                  <div className="mt-1 font-heading font-bold text-lg leading-snug text-white">{p.titre}</div>
                </div>
                <ul className="p-6 pt-4 space-y-3 flex-1">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-sm text-white/65 leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[#5CD9A0]" /> {pt}
                    </li>
                  ))}
                </ul>
                <div className="px-6 pb-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5CD9A0]/10 ring-1 ring-[#5CD9A0]/20 px-3 py-1 text-xs font-semibold text-[#5CD9A0]">
                    <Sparkles className="h-3 w-3" /> Bientôt disponible
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Comment ça marche</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Vous demandez, il prépare, vous validez</h2>
        </div>
        <div className="mt-12">
          <ProposerConfirmer />
        </div>
        <Reveal>
          <div className="mt-10 flex items-start gap-4 rounded-2xl border border-[#205040]/15 bg-[#205040]/4 p-6">
            <span className="h-10 w-10 shrink-0 rounded-xl bg-[#205040]/10 flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-[#205040]" /></span>
            <div>
              <div className="font-heading font-semibold text-[#14110F]">Le principe non négociable : l’humain décide</div>
              <p className="mt-1 text-sm text-[#57534E] leading-relaxed">
                Starkk ne prend aucune décision seul. Chaque envoi, chaque modification, chaque document passe par
                une confirmation humaine. Vos données restent dans votre espace Lab Learning et ne servent qu’à vous répondre.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── CTA (sombre) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20 md:pb-24">
        <Reveal>
          <div className="rounded-[32px] bg-[#0C1210] text-white px-6 md:px-16 py-16 md:py-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 -z-0 opacity-80" style={{ background: 'radial-gradient(600px 300px at 20% 0%, rgba(92,217,160,0.20), transparent 60%), radial-gradient(500px 260px at 100% 100%, rgba(56,197,136,0.14), transparent 55%)' }} />
            <div className="relative">
              {kickerSombre('L’IA au service du geste juste')}
              <h2 className="mt-6 ll-display ll-fluid-h1 text-balance max-w-3xl mx-auto text-white">Une formation suivie par des humains, épaulés par Starkk</h2>
              <p className="mt-4 text-white/60 max-w-xl mx-auto text-lg">
                Nos conseillers restent vos interlocuteurs. Starkk leur apporte des réponses
                immédiates et un suivi sans faille. Bientôt, il vous les apportera aussi.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#5CD9A0] text-[#0C1210] text-sm font-semibold hover:bg-[#38C588] ll-lift">
                  Parler à un conseiller <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/formations" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/25 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                  Voir nos formations
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
