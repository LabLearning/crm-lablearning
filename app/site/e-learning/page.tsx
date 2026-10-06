import Link from 'next/link'
import {
  ArrowRight, CheckCircle2, Sparkles, Laptop, Award, ListChecks, TrendingUp, SlidersHorizontal,
  Clock, Users, Store, UserCheck, Building2, Network, GraduationCap,
} from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { jsonLd } from '../jsonld'
import { QuizDemo } from './QuizDemo'
import { LexaConstruit } from './LexaConstruit'
import { Fenetre, TelephoneApprenant } from './Visuels'

const BASE = 'https://www.lab-learning.fr'
const LEARNEXA = 'https://learnexa.fr'

export const metadata = {
  title: 'E-learning en restauration avec Learnexa',
  description:
    'Learnexa, la plateforme e-learning de Lab Learning : modules courts sur téléphone, quiz, points et suivi de la progression pour les équipes de la restauration.',
  alternates: { canonical: '/e-learning' },
}

// Ce que la page dit de la plateforme reprend ce que Learnexa annonce sur learnexa.fr.

const OBSTACLES = [
  { Icon: Clock, t: 'Pas de temps mort', d: 'Un module tient en quelques minutes : il se suit entre deux services, sur le téléphone de l’équipier.' },
  { Icon: Users, t: 'Des équipes qui changent', d: 'Un nouvel arrivant accède aux bases dès son premier jour, sans attendre la prochaine session.' },
  { Icon: Store, t: 'Plusieurs établissements', d: 'Le même contenu et le même niveau d’exigence partout, sans multiplier les déplacements.' },
]

const ATOUTS = [
  { Icon: Laptop, t: 'Sur tous les écrans', d: 'Ordinateur, tablette, téléphone : une plateforme web, sans rien installer.' },
  { Icon: Award, t: 'Des points, des niveaux, des badges', d: 'Chaque module rapporte des points. On monte de niveau, on débloque des badges, on défie ses collègues.' },
  { Icon: Sparkles, t: 'Lexa, un tuteur dans chaque chapitre', d: 'Une notion pas comprise ? Lexa la réexplique et donne un exemple. Elle ne souffle jamais les réponses des quiz.' },
  { Icon: ListChecks, t: 'Des exercices variés', d: 'QCM, vrai ou faux, glisser-déposer, cartes mémoire : on ne lit pas un document, on pratique.' },
  { Icon: TrendingUp, t: 'La progression, en clair', d: 'Le manager voit où en est chaque équipier, et il est alerté quand une compétence manque dans l’équipe.' },
  { Icon: SlidersHorizontal, t: 'À vos couleurs', d: 'Logo, couleurs, e-mails : dans un réseau, chaque enseigne garde son identité.' },
]

const AGENTS = [
  { img: 'architecte', nom: 'L’Architecte', role: 'structure le parcours' },
  { img: 'redacteur', nom: 'Le Rédacteur', role: 'écrit les chapitres' },
  { img: 'illustrateur', nom: 'L’Illustrateur', role: 'crée les visuels' },
  { img: 'evaluateur', nom: 'L’Évaluateur', role: 'compose les quiz' },
]

const ROLES = [
  { Icon: GraduationCap, t: 'L’équipier', d: 'Un parcours à suivre comme un jeu : quêtes du jour, séries, badges.' },
  { Icon: UserCheck, t: 'Le formateur', d: 'Il construit les cours, anime les sessions et suit ses apprenants.' },
  { Icon: Building2, t: 'Le manager', d: 'Tableau de bord de l’équipe, alertes, classement, rapports.' },
  { Icon: Network, t: 'La tête de réseau', d: 'Pilotage d’ensemble, identité de chaque enseigne, accès et contenus.' },
]

const ETAPES = [
  { t: 'La formation, chez vous', d: 'Un formateur praticien vient dans votre établissement et forme l’équipe sur ses postes, avec votre matériel.' },
  { t: 'Les rappels, en ligne', d: 'Learnexa prend le relais : des modules courts reprennent les gestes appris, pour qu’ils restent.' },
  { t: 'Le suivi, dans la durée', d: 'Vous voyez qui a suivi quoi, et où il faut revenir. Le prochain passage du formateur part de là.' },
]

const pastille = (label: string) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-[#5271FF]/15 ring-1 ring-[#5271FF]/35 px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase text-[#A8B8FF]">
    {label}
  </span>
)

export default function SiteELearning() {
  const schemas = [{
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'E-learning avec Learnexa' },
    ],
  }]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      {/* ── HERO (nuit, aux couleurs de Learnexa) ── */}
      <section className="relative overflow-hidden bg-[#0B1222] text-white">
        <div className="absolute inset-0 opacity-90" style={{ background: 'radial-gradient(900px 520px at 12% -10%, rgba(82,113,255,0.34), transparent 60%), radial-gradient(700px 420px at 100% 10%, rgba(34,211,238,0.16), transparent 55%), radial-gradient(600px 400px at 60% 110%, rgba(124,58,237,0.20), transparent 60%)' }} />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 ll-rise">
            {pastille('Notre plateforme e-learning')}
            <h1 className="mt-6 ll-display ll-fluid-hero text-white text-balance">
              Voici <span className="inline-block bg-gradient-to-r from-[#7C93FF] to-[#22D3EE] bg-clip-text text-transparent pr-2 pb-3 -mb-3">Learnexa</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              La plateforme e-learning de Lab Learning prolonge la formation au-delà du jour J : des modules courts,
              sur téléphone, que vos équipes ouvrent par envie.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#demo" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#5271FF] text-white text-sm font-semibold hover:bg-[#4460E6] ll-lift">
                Essayer en 30 secondes <ArrowRight className="h-4 w-4" />
              </a>
              <a href={LEARNEXA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                Voir learnexa.fr
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#22D3EE]" /> Ordinateur, tablette et mobile</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#22D3EE]" /> Hébergée en Europe</span>
            </div>
          </div>

          <div className="lg:col-span-7 ll-rise" style={{ animationDelay: '0.12s' }}>
            <Fenetre src="/site/photos/learnexa/apprenant.webp" alt="Tableau de bord d’un apprenant sur Learnexa : formations, quiz, badges et mini-jeux">
              <div className="ll-el-flotte absolute -left-4 sm:-left-8 top-[18%] flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-xl shadow-black/30">
                <img src="/site/photos/learnexa/niveau-4.webp" alt="" width={176} height={176} className="h-9 w-9" />
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Niveau débloqué</span>
                  <span className="block font-heading text-sm font-bold text-[#0F172A]">Niveau 13</span>
                </span>
              </div>
              <div className="ll-el-flotte-lent absolute -right-3 sm:-right-6 bottom-[14%] rounded-2xl bg-[#0B1222] px-4 py-3 ring-1 ring-white/15 shadow-xl shadow-black/40">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#22D3EE]">Quiz HACCP</div>
                <div className="mt-0.5 font-heading text-sm font-bold text-white">3 bonnes réponses sur 3</div>
              </div>
              <div className="ll-el-pop absolute right-[12%] top-[8%] rounded-full bg-[#22D3EE] px-3 py-1 text-xs font-bold text-[#0B1222] shadow-lg shadow-[#22D3EE]/30">+50 XP</div>
            </Fenetre>
          </div>
        </div>
      </section>

      {/* ── LE CONSTAT (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Le constat</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Une formation qu’on n’ouvre pas ne forme personne</h2>
          <p className="mt-4 text-lg text-[#57534E]">
            En restauration, la formation bute toujours sur les mêmes obstacles. Learnexa est faite pour eux.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {OBSTACLES.map((o, i) => (
            <Reveal key={o.t} delay={i * 80}>
              <div className="h-full rounded-2xl border border-[#205040]/10 bg-white p-6">
                <span className="h-11 w-11 rounded-xl bg-[#5271FF]/10 flex items-center justify-center mb-4"><o.Icon className="h-5 w-5 text-[#5271FF]" /></span>
                <div className="font-heading font-semibold text-[#14110F]">{o.t}</div>
                <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{o.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── DÉMONSTRATION JOUABLE ── */}
      <section id="demo" className="scroll-mt-24 bg-[#FAFAFA] border-y border-[#205040]/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <Kicker className="mb-4">Essayez par vous-même</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Trois questions, trente secondes</h2>
            <p className="mt-4 text-lg text-[#57534E] leading-relaxed">
              Répondez, gagnez des points, lisez l’explication : c’est ce que vivent vos équipes sur Learnexa.
            </p>
            <p className="mt-3 text-sm text-[#78716C]">
              Une démonstration sur l’hygiène alimentaire. Sur la plateforme, les parcours peuvent porter sur vos propres procédures.
            </p>
          </div>
          <div className="lg:col-span-7">
            <Reveal><QuizDemo /></Reveal>
          </div>
        </div>
      </section>

      {/* ── CE QUE VOS ÉQUIPES Y TROUVENT (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Ce que vos équipes y trouvent</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">On y apprend comme on joue</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ATOUTS.map((a, i) => (
            <Reveal key={a.t} delay={(i % 3) * 80}>
              <div className="group h-full rounded-2xl border border-[#205040]/10 bg-white p-6 hover:shadow-lg hover:shadow-black/5 hover:border-[#5271FF]/30 ll-lift">
                <span className="h-11 w-11 rounded-xl bg-[#5271FF]/10 flex items-center justify-center mb-4 group-hover:bg-[#5271FF] transition-colors">
                  <a.Icon className="h-5 w-5 text-[#5271FF] group-hover:text-white transition-colors" />
                </span>
                <div className="font-heading font-semibold text-[#14110F]">{a.t}</div>
                <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{a.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── LEXA CONSTRUIT (nuit) ── */}
      <section className="relative overflow-hidden bg-[#0B1222] text-white">
        <div className="absolute inset-0 opacity-80" style={{ background: 'radial-gradient(700px 400px at 90% 0%, rgba(82,113,255,0.22), transparent 55%), radial-gradient(600px 360px at 0% 100%, rgba(124,58,237,0.18), transparent 55%)' }} />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-5">
              {pastille('Création par IA')}
              <h2 className="mt-5 ll-display ll-fluid-h2 text-white text-balance">Décrivez. Lexa construit.</h2>
              <p className="mt-4 text-lg text-white/65 leading-relaxed">
                Une phrase suffit. Lexa, l’intelligence artificielle de Learnexa, bâtit le parcours : structure, chapitres,
                visuels, quiz. Vous relisez, vous ajustez, vous publiez.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {AGENTS.map((a, i) => (
                  <div key={a.nom} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-3">
                    <img src={`/site/photos/learnexa/${a.img}.webp`} alt="" width={320} height={320} loading="lazy"
                      className="h-12 w-12 shrink-0 ll-el-flotte" style={{ animationDelay: `${i * 0.6}s` }} />
                    <span className="min-w-0">
                      <span className="block font-heading text-sm font-semibold text-white">{a.nom}</span>
                      <span className="block text-xs text-white/55">{a.role}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-7">
              <LexaConstruit />
            </div>
          </div>

          <Reveal className="mt-14 md:mt-20">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
              <div className="lg:col-span-7 lg:order-1">
                <Fenetre src="/site/photos/learnexa/builder.webp" alt="Le constructeur de cours de Learnexa : texte, image, vidéo, QCM, cartes mémoire, vrai ou faux" hauteur={773} />
              </div>
              <div className="lg:col-span-5 lg:order-2">
                <h3 className="font-heading text-2xl font-bold text-white text-balance">Vos procédures deviennent un parcours</h3>
                <p className="mt-3 text-white/65 leading-relaxed">
                  Ouverture, fermeture, friteuse, encaissement, accueil d’un nouvel équipier : ce qui se transmet à l’oral
                  peut devenir un module, avec ses images, sa vidéo et son quiz.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {['Texte, image, vidéo, audio, PDF', 'QCM, vrai ou faux, cartes mémoire, éléments à ordonner', 'Un studio pour filmer l’écran ou la caméra, sans autre logiciel'].map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm text-white/75 leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[#22D3EE]" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CHAQUE RÔLE A SON ESPACE (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        <div className="lg:col-span-5">
          <Reveal><TelephoneApprenant /></Reveal>
        </div>
        <div className="lg:col-span-7">
          <Kicker className="mb-4">Chaque rôle a son espace</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">L’équipier joue, le manager pilote</h2>
          <p className="mt-4 text-lg text-[#57534E] leading-relaxed">
            Chacun ouvre un espace pensé pour lui, avec ce qui le concerne et rien d’autre.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r.t} className="flex items-start gap-3.5 rounded-2xl bg-white ring-1 ring-black/5 p-5">
                <span className="h-10 w-10 shrink-0 rounded-xl bg-[#5271FF]/10 flex items-center justify-center"><r.Icon className="h-5 w-5 text-[#5271FF]" /></span>
                <div>
                  <div className="font-heading font-semibold text-[#14110F]">{r.t}</div>
                  <p className="mt-1 text-sm text-[#57534E] leading-relaxed">{r.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRÉSENTIEL PUIS E-LEARNING (teinté) ── */}
      <section className="bg-[#F6F4EF]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="max-w-2xl">
            <Kicker className="mb-4">Notre méthode</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Le formateur d’abord, Learnexa ensuite</h2>
            <p className="mt-4 text-lg text-[#57534E] leading-relaxed">
              Un geste s’apprend au poste, avec quelqu’un qui le maîtrise. L’e-learning ne le remplace pas : il l’empêche de s’effacer.
            </p>
          </div>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {ETAPES.map((e, i) => (
              <li key={e.t}>
                <Reveal delay={i * 90}>
                  <div className="h-full rounded-2xl bg-white ring-1 ring-black/5 p-6">
                    <div className="ll-index text-4xl text-[#205040]/25">{i + 1}</div>
                    <div className="mt-3 font-heading text-lg font-semibold text-[#14110F]">{e.t}</div>
                    <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{e.d}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          <Link href="/formations" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
            Voir nos formations en établissement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── CTA (nuit) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24">
        <Reveal>
          <div className="rounded-[32px] bg-[#0B1222] text-white px-6 md:px-16 py-16 md:py-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-90" style={{ background: 'radial-gradient(600px 300px at 20% 0%, rgba(82,113,255,0.30), transparent 60%), radial-gradient(500px 260px at 100% 100%, rgba(34,211,238,0.16), transparent 55%)' }} />
            <div className="relative">
              <img src="/site/logos/learnexa-clair.svg" alt="Learnexa" width={114} height={27} className="mx-auto h-8 w-auto" />
              <h2 className="mt-7 ll-display ll-fluid-h1 text-balance max-w-3xl mx-auto text-white">Voyez Learnexa avec vos propres contenus</h2>
              <p className="mt-4 text-white/60 max-w-xl mx-auto text-lg">
                Dites-nous combien d’établissements vous avez et ce que vos équipes doivent savoir : nous vous montrons la plateforme.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#5271FF] text-white text-sm font-semibold hover:bg-[#4460E6] ll-lift">
                  En parler avec nous <ArrowRight className="h-4 w-4" />
                </Link>
                <a href={LEARNEXA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/25 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                  Essayer sur learnexa.fr
                </a>
              </div>
              <p className="mt-5 text-sm text-white/40">Learnexa propose 14 jours d’essai, sans carte bancaire.</p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
