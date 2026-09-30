import Link from 'next/link'
import { ArrowRight, ShieldCheck, GraduationCap, Users, CheckCircle2, Building2, UserCheck, Banknote, SlidersHorizontal, Briefcase, DoorOpen, TrendingUp, MonitorPlay, Laptop } from './icons'
import { getPublicSiteData, getBranchesData, getPublicTemoignages, getFormationsPopulaires } from '@/lib/public-site-data'
import { Temoignages } from './Temoignages'
import { photoFormation } from '@/lib/formations-photos'
import { titreFormation } from '@/lib/utils'
import { Star, Clock } from './icons'
import { CountUp } from './CountUp'
import { MetierVisual } from './MetierVisual'
import { StoryChapter } from './StoryChapter'
import { Reveal } from './Reveal'
import { FilmSection } from './FilmSection'
import { Kicker } from './Kicker'
import { Marquee } from './Marquee'
import { PhotoStrip } from './PhotoStrip'
import { BRANCHES } from './branches'

export const dynamic = 'force-dynamic'

export const metadata = {
  alternates: { canonical: '/' },
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

const POURQUOI = [
  { Icon: UserCheck, t: 'Des formateurs de terrain', d: 'Des praticiens du métier qui transmettent le geste réel, pas de la théorie hors-sol.' },
  { Icon: Banknote, t: 'Financement accompagné', d: 'On vous guide dans votre dossier OPCO et on fait en sorte que la formation soit prise en charge.' },
  { Icon: ShieldCheck, t: 'Qualité certifiée Qualiopi', d: 'Des parcours évalués et tracés, du positionnement à l’attestation.' },
  { Icon: SlidersHorizontal, t: 'Sur-mesure', d: 'Programmes adaptés à votre établissement, vos équipes et vos contraintes d’exploitation.' },
]

export default async function SiteHome() {
  const [{ stats, franchises }, branches, temoignages, populaires] = await Promise.all([
    getPublicSiteData(), getBranchesData(), getPublicTemoignages(), getFormationsPopulaires(3),
  ])
  const brancheCount = new Map(branches.map((b) => [b.slug, b.total]))

  const chapitres = [
    {
      // Ni POEI ni France Travail sur le site : Lab Learning n'est pas partenaire
      // de France Travail et ne met pas en avant ses dispositifs (courrier de
      // France Travail Auvergne-Rhône-Alpes du 30/09/2026).
      index: 1, eyebrow: 'Ouverture', title: 'On vous aide à ouvrir avec une équipe déjà prête',
      desc: 'Dès l’embauche, avant l’ouverture, on forme votre nouvelle équipe aux gestes du métier, à l’hygiène et au service. Vous démarrez avec une équipe opérationnelle dès le premier jour.',
      bullets: ['Formation de vos nouveaux salariés', 'Gestes métier, hygiène et service', 'Équipe opérationnelle dès le jour 1'],
      Icon: DoorOpen, from: '#134E4A', to: '#0F766E',
      img: '/site/formations/ef4c5ead-d029-4734-9c51-93d248a30d0e.webp',
      chips: [{ Icon: Briefcase, label: 'Avant l’ouverture' }, { Icon: Users, label: 'Équipe prête au jour 1' }],
    },
    {
      index: 2, eyebrow: 'Exploitation', title: 'On fait grandir vos équipes pendant l’exploitation',
      desc: 'Une fois ouvert, on forme vos équipes en poste en continu via le plan de développement des compétences, financé par votre OPCO. La montée en compétence suit le rythme de votre établissement.',
      bullets: ['Plan de développement des compétences', 'Financé par votre OPCO', 'Formations métier pendant l’activité'],
      Icon: TrendingUp, from: '#1E3A8A', to: '#4338CA',
      img: '/site/formations/e367c74f-8b21-4bda-b5bd-d301da5ceedb.webp',
      chips: [{ Icon: Building2, label: 'OPCO' }, { Icon: CheckCircle2, label: `${fmt(stats.sessionsRealisees)} sessions réalisées` }],
      flip: true,
    },
    {
      index: 3, eyebrow: 'Formation continue', title: 'On ancre les acquis en digital avec Learnexa',
      desc: 'Pour ancrer durablement les compétences, notre plateforme e-learning Learnexa prolonge la formation en ligne : vos équipes se forment à leur rythme, où qu’elles soient, avec un suivi de la progression.',
      bullets: ['Notre plateforme e-learning Learnexa', 'Modules à la demande, accessibles partout', 'Suivi de la progression en continu'],
      Icon: MonitorPlay, from: '#4C1D95', to: '#7C3AED',
      img: '/site/formations/18570280-76ec-474e-8312-3f30a12005d9.webp',
      chips: [{ Icon: Laptop, label: 'Plateforme Learnexa' }, { Icon: GraduationCap, label: `${fmt(stats.apprenants)} stagiaires formés` }],
      href: 'https://learnexa.fr', cta: 'Découvrir Learnexa',
    },
  ]

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ll-grid-faint" />
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(1200px 600px at 12% -12%, rgba(25,81,68,0.12), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(99,102,241,0.10), transparent 55%)' }} />
        <div className="ll-orb-a absolute -z-10 -top-24 -left-16 h-72 w-72 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(25,81,68,0.28), transparent 65%)' }} />
        <div className="ll-orb-b absolute -z-10 top-10 right-0 h-80 w-80 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22), transparent 65%)' }} />

        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 grid lg:grid-cols-12 gap-12 lg:gap-12 items-center">
          <div className="ll-rise lg:col-span-6">
            <h1 className="ll-display ll-fluid-hero text-[#14110F] text-balance">
              Former les métiers de bouche avec l’exigence du{' '}
              {/* inline-block + marges compensées : le clip du dégradé englobe
                  les jambages et le débord de l'italique au lieu de les couper */}
              <span className="italic inline-block bg-gradient-to-r from-[#205040] to-[#38C588] bg-clip-text text-transparent px-2 -mx-2 pb-3 -mb-3">geste juste</span>.
            </h1>
            <p className="mt-7 text-lg md:text-xl text-[#57534E] max-w-xl leading-relaxed">
              Du recrutement à la rentabilité, on est à vos côtés : formation de votre équipe dès l’ouverture, montée en compétence
              pendant l’exploitation, puis formation continue en e-learning avec Learnexa.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/site/formations" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#205040] text-white text-sm font-semibold hover:bg-[#123f34] ll-lift">
                Découvrir nos formations <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/site/contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#205040]/25 text-[#205040] text-sm font-semibold hover:bg-[#205040]/5 transition-colors">
                Parler à un conseiller
              </Link>
            </div>
            {/* Qualiopi : logo officiel + mention obligatoire, sous l'appel à l'action */}
            <div className="mt-8 flex w-fit max-w-full items-center gap-5 rounded-2xl bg-white shadow-lg shadow-black/10 ring-1 ring-black/5 px-5 py-4 sm:px-6 sm:py-5">
              <img src="/site/logos/qualiopi.png" alt="Qualiopi, processus certifié, République française" className="h-14 sm:h-[76px] w-auto shrink-0" />
              <p className="max-w-[250px] text-[11px] sm:text-[13px] leading-snug text-[#57534E]">
                La certification qualité a été délivrée au titre de la catégorie d&apos;actions suivante : ACTIONS DE FORMATION
              </p>
            </div>
          </div>

          {/* Collage métier (données live) — asymétrique */}
          {BRANCHES.length >= 2 && (
            <div className="ll-rise lg:col-span-6 grid grid-cols-2 gap-4 sm:gap-5 relative" style={{ animationDelay: '0.12s' }}>
              {BRANCHES.map((b, i) => (
                <Link key={b.slug} href={`/site/branches/${b.slug}`}
                  className={`group rounded-3xl overflow-hidden shadow-sm ring-1 ring-black/5 ll-lift ${i % 2 === 1 ? 'translate-y-6 sm:translate-y-10' : ''}`}>
                  <MetierVisual nom={b.label} label={b.label} height={i % 2 === 1 ? 'h-56 sm:h-72' : 'h-52 sm:h-64'} />
                  <div className="bg-white px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#78716C]">{brancheCount.get(b.slug) || 0} formation{(brancheCount.get(b.slug) || 0) > 1 ? 's' : ''}</span>
                    <ArrowRight className="h-4 w-4 text-[#205040] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FILM DE PRÉSENTATION (v2, muet, 1 min 14), en pleine largeur ──
          Ancien film supprimé le 30/09/2026 : un plan annonçait « POEI ·
          France Travail ». Tout nouveau film est relu image par image avant
          publication (ni POEI, ni France Travail, mention Qualiopi complète). */}
      <FilmSection
        src="/site/video/lab-learning-presentation-v2.mp4"
        poster="/site/video/lab-learning-presentation-v2-affiche.jpg"
        titre="Lab Learning en une minute"
      />

      {/* ── PREUVES / FRANCHISES (marquee live) ── */}
      {franchises.length > 0 && (
        <section className="bg-[#FAFAFA] border-y border-[#205040]/10 py-16 md:py-20 overflow-hidden">
          <div className="max-w-6xl mx-auto px-5 md:px-8 text-center">
            <Kicker center className="mb-4 justify-center">Ils nous font confiance</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] tracking-heading">Des réseaux franchisés nationaux</h2>
            <p className="mt-3 text-[#57534E] max-w-xl mx-auto">Des enseignes multi-sites nous confient la montée en compétence de leurs équipes, partout en France.</p>
          </div>
          <div className="mt-10">
            <Marquee items={franchises.map((f) => ({ nom: f.nom, logo_url: f.logo_url, nombre_etablissements: f.nombre_etablissements }))} />
          </div>
          <div className="mt-10 text-center">
            <Link href="/site/partenaires" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
              Voir tous nos clients et partenaires <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ── FORMATIONS POPULAIRES : les plus suivies, données live ── */}
      {populaires.length >= 2 && (
        <section className="bg-[#FAFAFA] border-y border-[#205040]/10">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-20">
            <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
              <div className="max-w-2xl">
                <Kicker className="mb-4">Les plus demandées</Kicker>
                <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Nos formations les plus suivies</h2>
              </div>
              <Link href="/site/formations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
                Toutes nos formations <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {populaires.map((p: any, i: number) => (
                <Reveal key={p.id} delay={(i % 3) * 80} className="h-full">
                  <Link href={`/site/formations/${p.id}`}
                    className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-xl hover:shadow-black/5 ll-lift">
                    {photoFormation(p.id) && (
                      <div className="relative h-44 overflow-hidden">
                        <img loading="lazy" src={photoFormation(p.id)!} alt=""
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {p.taux_satisfaction != null && (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#14110F] shadow-sm">
                            <Star className="h-3.5 w-3.5 text-[#F59E0B]" /> {(p.taux_satisfaction / 20).toFixed(1)}/5
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-5 md:p-6 flex flex-col flex-1">
                      <div className="font-heading font-semibold text-[#14110F] leading-snug">{titreFormation(p.intitule)}</div>
                      <div className="mt-3 flex items-center gap-4 text-xs text-[#78716C]">
                        {p.duree_heures && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{p.duree_heures} h</span>}
                        {p.nombre_apprenants_total && <span>{p.nombre_apprenants_total} stagiaires formés</span>}
                      </div>
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#205040]">
                          {p.tarif_inter_ht ? `${Number(p.tarif_inter_ht).toLocaleString('fr-FR')} € HT / pers.` : p.tarif_intra_ht ? `${Number(p.tarif_intra_ht).toLocaleString('fr-FR')} € HT` : 'Sur devis'}
                        </span>
                        <span className="h-9 w-9 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] group-hover:bg-[#205040] group-hover:text-white transition-colors">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BRANCHES MÉTIER ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Votre métier</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Des formations pensées pour votre activité</h2>
          <p className="mt-4 text-lg text-[#57534E]">Identifiez-vous par votre métier : on vous montre ce à quoi vous avez droit, financement compris.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {BRANCHES.map((b, i) => (
            <Reveal key={b.slug} delay={(i % 2) * 90} className="h-full">
              <Link href={`/site/branches/${b.slug}`} className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-[#205040]/25 hover:shadow-xl hover:shadow-black/5 ll-lift">
                <MetierVisual nom={b.label} label={b.label} height="h-48 md:h-52" />
                <div className="p-5 md:p-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[15px] text-[#57534E]">{b.tagline}</div>
                    <div className="text-xs text-[#A8A29E] mt-1">{brancheCount.get(b.slug) || 0} formation{(brancheCount.get(b.slug) || 0) > 1 ? 's' : ''}</div>
                  </div>
                  <span className="shrink-0 h-10 w-10 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] group-hover:bg-[#205040] group-hover:text-white transition-colors">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── POURQUOI NOUS ── */}
      <section className="bg-[#FAFAFA] border-y border-[#205040]/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="max-w-2xl">
            <Kicker className="mb-4">Pourquoi Lab Learning</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Un partenaire formation, pas juste un catalogue</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {POURQUOI.map((p, i) => (
              <Reveal key={p.t} delay={(i % 4) * 80}>
              <div className="group h-full rounded-2xl border border-[#205040]/10 bg-white p-6 hover:shadow-lg hover:shadow-black/5 hover:border-[#205040]/25 ll-lift">
                <span className="h-11 w-11 rounded-xl bg-[#205040]/8 flex items-center justify-center mb-4 group-hover:bg-[#205040] transition-colors"><p.Icon className="h-5 w-5 text-[#205040] group-hover:text-white transition-colors" /></span>
                <div className="font-heading font-semibold text-[#14110F]">{p.t}</div>
                <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">{p.d}</p>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── STORYTELLING CHAPITRÉ : du recrutement à la rentabilité ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <Reveal className="max-w-3xl">
          <Kicker className="mb-4">Notre accompagnement</Kicker>
          <h2 className="ll-display ll-fluid-h1 text-[#14110F] text-balance">
            Du recrutement à la rentabilité, <span className="text-[#205040]">on est avec vous</span>.
          </h2>
          <p className="mt-5 text-lg md:text-xl text-[#57534E] leading-relaxed">
            De l’ouverture à la montée en compétence de vos équipes, jusqu’à la formation continue
            en e-learning : un partenaire unique sur tout le cycle de vie de votre établissement.
          </p>
        </Reveal>
        <div className="mt-16 md:mt-20 space-y-20 md:space-y-28">
          {chapitres.map((c) => <Reveal key={c.index}><StoryChapter {...(c as any)} /></Reveal>)}
        </div>
      </section>

      {/* ── SUR LE TERRAIN : bandeau photo défilant ── */}
      <section className="py-14 md:py-16 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-8 mb-7">
          <Kicker className="mb-3">Sur le terrain</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F]">La formation, là où elle sert</h2>
        </div>
        <PhotoStrip photos={[
          '/site/formations/8ecde6a5-2c18-4986-a4f9-8284f0a8ed04.webp',
          '/site/formations/1f49d299-aae7-4b99-8ae8-4e3ff30beda8.webp',
          '/site/formations/df3380ba-cdfc-44a6-b05d-88dacc6e67a8.webp',
          '/site/formations/744f87d8-2448-4812-83b0-41659f8a0c1c.webp',
          '/site/formations/d0e0d5e2-e030-41db-9410-9551eab859eb.webp',
          '/site/formations/02e7b672-a240-460e-a07a-c5bd05f9781a.webp',
          '/site/formations/ee0ad136-b3c4-48c6-8e9c-db41804c2be3.webp',
          '/site/formations/acbea88f-a944-4dea-b21d-9c18e27962b5.webp',
          '/site/formations/13d9e648-b08b-4dee-9bad-f060f0dd9cb7.webp',
          '/site/formations/061983bf-0572-42ed-8022-4a5a7cc52e1f.webp',
        ]} />
      </section>

      {/* ── TÉMOIGNAGES : verbatims réels du registre d'appréciations ── */}
      {temoignages.length >= 2 && (
        <section className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <Kicker className="mb-4">Ce qu'ils en disent</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">La parole aux établissements formés</h2>
            <p className="mt-3 text-[#57534E]">
              Appréciations recueillies après chaque formation, dans le cadre de notre démarche qualité Qualiopi.
            </p>
          </div>
          <Reveal><Temoignages items={temoignages} /></Reveal>
          <div className="mt-8 text-center">
            <Link href="/site/resultats" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
              Voir tous nos résultats <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ── STATS (live) ── */}
      <section className="border-y border-[#205040]/10 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 md:divide-x md:divide-[#205040]/10">
          {[
            { v: stats.formations, l: 'formations au catalogue', Icon: GraduationCap },
            { v: stats.apprenants, l: 'stagiaires formés', Icon: Users },
            { v: stats.sessionsRealisees, l: 'sessions réalisées', Icon: CheckCircle2 },
            { v: stats.entreprises, l: 'entreprises accompagnées', Icon: Building2 },
          ].map((s, i) => (
            <div key={s.l} className={i > 0 ? 'md:pl-8' : ''}>
              <div className="flex items-center gap-1.5 text-[#205040] mb-2"><s.Icon className="h-4 w-4" /></div>
              <div className="ll-display text-4xl md:text-[52px] text-[#14110F] leading-none"><CountUp value={s.v} /></div>
              <div className="text-xs text-[#78716C] mt-2 uppercase tracking-wide">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="max-w-6xl mx-auto px-5 md:px-8 pb-10 -mt-2 text-center">
          <Link href="/site/resultats" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
            Tous nos indicateurs de résultats <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── MINI-FAQ : lever les dernières objections avant le CTA ── */}
      <section className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="text-center mb-10">
          <Kicker center className="mb-4 justify-center">Questions fréquentes</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F]">Avant de vous lancer</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: 'Combien coûte une formation, et qui la finance ?', r: "Dans la plupart des cas, votre OPCO prend en charge tout ou partie de la formation : nos tarifs sont calés sur les barèmes de votre branche, le reste à charge est souvent nul. On vous accompagne dans le dossier." },
            { q: 'La formation a-t-elle lieu dans mon établissement ?', r: "Oui, c'est notre spécialité : le formateur vient chez vous, forme vos équipes sur leur poste, avec votre matériel, sans fermer et sur vos horaires." },
            { q: 'Sous quel délai peut-on démarrer ?', r: "Une session se planifie généralement sous 2 à 4 semaines après validation du devis et de la prise en charge." },
            { q: 'Êtes-vous certifiés Qualiopi ?', r: "Oui : certification Qualiopi au titre des actions de formation, condition du financement par les OPCO. Nous sommes aussi inscrits sur la liste DRAAF pour l'hygiène alimentaire." },
          ].map((f, i) => (
            <details key={i} className="group rounded-2xl bg-white ring-1 ring-black/5 open:ring-[#205040]/20 open:shadow-lg open:shadow-black/5 transition-shadow">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4">
                <span className="font-heading font-semibold text-sm md:text-base text-[#14110F]">{f.q}</span>
                <span className="shrink-0 h-7 w-7 rounded-full bg-[#205040]/8 flex items-center justify-center text-[#205040] transition-transform group-open:rotate-90">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </summary>
              <div className="px-5 pb-4 -mt-1 text-sm text-[#57534E] leading-relaxed">{f.r}</div>
            </details>
          ))}
        </div>
        <div className="mt-7 text-center">
          <Link href="/site/faq" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#205040] hover:gap-2.5 transition-all">
            Toutes les questions fréquentes <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24">
        <Reveal>
        <div className="rounded-[32px] bg-[#14110F] text-white px-6 md:px-16 py-16 md:py-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 -z-0 opacity-70" style={{ background: 'radial-gradient(600px 300px at 20% 0%, rgba(25,81,68,0.5), transparent 60%), radial-gradient(500px 260px at 100% 100%, rgba(99,102,241,0.35), transparent 55%)' }} />
          <div className="relative">
            <Kicker tone="light" center className="mb-5 justify-center">Prêt à démarrer</Kicker>
            <h2 className="ll-display ll-fluid-h1 text-balance max-w-3xl mx-auto text-white">Prêt à faire monter vos équipes en compétences ?</h2>
            <p className="mt-4 text-white/70 max-w-xl mx-auto text-lg">Nous étudions votre besoin, vous accompagnons dans le financement OPCO et planifions les sessions.</p>
            <Link href="/site/contact" className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#14110F] text-sm font-semibold hover:bg-[#F6F4EF] ll-lift">
              Demander un devis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        </Reveal>
      </section>
    </>
  )
}
