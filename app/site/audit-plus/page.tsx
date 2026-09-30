import Link from 'next/link'
import {
  ArrowRight, CheckCircle2, X, ClipboardCheck, ShieldCheck, Wheat, Sparkles,
  Network, Laptop, Monitor, Building2, Users, TrendingUp, Whatsapp,
} from '../icons'
import { Kicker } from '../Kicker'
import { Reveal } from '../Reveal'
import { AuditPlusFilm } from './AuditPlusFilm'
import { lienWhatsapp } from '../whatsapp'

export const metadata = {
  title: 'Audit+, notre outil d’audit terrain',
  description:
    'Audit+ réunit l’audit hygiène HACCP, le document unique (DUERP) et le tableau des allergènes dans une seule application, sur ordinateur, tablette et smartphone : grille guidée, photos, score en direct, rapport PDF en un clic.',
  alternates: { canonical: '/audit-plus' },
}

/*
 * Chiffres réels, tirés des audits Audit+ recopiés dans le CRM (tables ah_*),
 * relevés le 30/09/2026 : 142 audits finalisés dans 99 établissements depuis
 * le 16/03/2026, 76 DUERP ; sur les 34 établissements audités au moins deux
 * fois, score moyen de 60 au premier audit et de 79 au dernier, 32 en
 * progression. À recalculer avant toute mise à jour de la page.
 */
const CHIFFRES = [
  { v: '142', l: 'audits réalisés', d: 'depuis mars 2026' },
  { v: '99', l: 'établissements audités', d: 'restauration rapide et métiers de bouche' },
  { v: '76', l: 'documents uniques (DUERP)', d: 'construits avec les équipes' },
]

const OUTILS = [
  {
    Icon: ClipboardCheck, nom: 'Audit hygiène HACCP', teinte: '#205040', fond: 'bg-[#205040]/8',
    points: [
      '71 points de contrôle, répartis en 8 domaines',
      'Une grille guidée, domaine par domaine, qui signale les points critiques',
      'Les photos preuves prises directement dans l’audit',
      'Le score de conformité calculé en direct',
      'Le rapport PDF détaillé, envoyé par e-mail en un clic',
    ],
  },
  {
    Icon: ShieldCheck, nom: 'Document unique (DUERP)', teinte: '#B45309', fond: 'bg-[#B45309]/8',
    points: [
      '11 trames métiers pré-remplies, à ajuster à l’établissement',
      'Chaque risque coté en gravité et probabilité : la criticité est calculée',
      'Un plan d’actions avec responsable, échéance et statut',
      'Un rappel par e-mail quand la révision approche',
    ],
  },
  {
    Icon: Wheat, nom: 'Allergènes', teinte: '#B42318', fond: 'bg-[#B42318]/8',
    points: [
      'Les 14 allergènes réglementaires, plat par plat',
      'Le code-barres des produits scanné sur place',
      'Ou l’étiquette photographiée : l’IA propose, le formateur valide',
      'Un tableau indicatif, à relire avant tout affichage',
    ],
    ia: true,
  },
]

const TERRAIN = [
  { Icon: Network, t: 'Réseau coupé\u00A0? L’audit continue', d: 'Les réponses et les photos de l’audit hygiène en cours restent sur l’appareil, puis se synchronisent au retour du réseau.' },
  { Icon: Laptop, t: 'Smartphone, tablette, ordinateur', d: 'Une application web, pensée d’abord pour le terrain, sur tous les écrans.' },
  { Icon: Monitor, t: 'S’installe sur l’écran d’accueil', d: 'Audit+ s’ouvre comme une application, sans passer par un magasin d’applications.' },
  { Icon: Building2, t: 'La fiche remplie depuis le SIRET', d: 'Tapez le SIRET : les informations de l’établissement se remplissent.' },
  { Icon: Users, t: 'Toute l’équipe, un seul tableau de bord', d: 'Chaque auditeur a son accès personnel, avec des droits par outil.' },
  { Icon: TrendingUp, t: 'Entrée, sortie\u00A0: le compte rendu', d: 'Audit d’entrée et audit de sortie comparés : progression par domaine, non-conformités levées ou restantes.' },
]

const kickerSombre = (label: string) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-[#5CD9A0]/10 ring-1 ring-[#5CD9A0]/25 px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase text-[#5CD9A0]">
    <ClipboardCheck className="h-3.5 w-3.5" /> {label}
  </span>
)

const DEMO_WHATSAPP = lienWhatsapp('Bonjour, je souhaite une démonstration d’Audit+.')

export default function SiteAuditPlus() {
  return (
    <>
      {/* ── HERO (sombre) ── */}
      <section className="relative overflow-hidden bg-[#0C1210] text-white">
        <div className="absolute inset-0 opacity-80" style={{ background: 'radial-gradient(900px 500px at 15% -10%, rgba(92,217,160,0.20), transparent 60%), radial-gradient(700px 400px at 100% 10%, rgba(56,197,136,0.12), transparent 55%)' }} />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 ll-rise">
            {kickerSombre('Notre outil d’audit terrain')}
            <h1 className="mt-6 ll-display ll-fluid-hero text-white">
              Audit<span className="bg-gradient-to-r from-[#5CD9A0] to-[#38C588] bg-clip-text text-transparent">+</span>
            </h1>
            <p className="mt-5 font-heading font-bold text-2xl md:text-3xl text-white text-balance">
              HACCP, DUERP, allergènes{'\u00A0'}: <span className="text-[#5CD9A0]">une seule application.</span>
            </p>
            <p className="mt-5 text-lg text-white/70 leading-relaxed">
              Nos formateurs auditent vos établissements sur tablette ou smartphone : grille guidée,
              photos à l’appui, score calculé en direct et rapport envoyé en un clic.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/site/contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#5CD9A0] text-[#0C1210] text-sm font-semibold hover:bg-[#38C588] ll-lift">
                Demander une démo <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#film" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                Voir la présentation
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/55">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#5CD9A0]" /> Smartphone, tablette, ordinateur</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#5CD9A0]" /> L’audit continue si le réseau coupe</span>
            </div>
          </div>
          <div className="lg:col-span-7 ll-rise" style={{ animationDelay: '0.12s' }}>
            <AuditPlusFilm src="/site/video/audit-plus-presentation.mp4" poster="/site/video/audit-plus-affiche.jpg" duree="1 min 16" />
            <details className="mt-4 text-sm text-white/55">
              <summary className="cursor-pointer select-none hover:text-white/80">Lire le texte de la vidéo</summary>
              <p className="mt-3 leading-relaxed">
                Grilles papier, photos éparpillées, rapports retapés le soir, et le DUERP repart de zéro.
                Audit+ : HACCP, DUERP, allergènes, une seule application. Audit hygiène HACCP : 71 points de
                contrôle, 8 domaines, grille guidée domaine par domaine. Score de conformité calculé en direct.
                Réseau coupé ? L’audit en cours continue. Rapport PDF détaillé et envoi par e-mail, en un clic.
                Document unique : 11 trames métiers pré-remplies, gravité et probabilité, criticité calculée,
                plan d’actions avec responsable, échéance et statut. Allergènes : scannez le code-barres ou
                photographiez l’étiquette, l’IA propose et le formateur valide ; 14 allergènes, plat par plat.
                Entrée, sortie : la progression mesurée. Tapez le SIRET, la fiche se remplit. Toute l’équipe,
                un seul tableau de bord. Ordinateur, tablette, smartphone. L’audit terrain, sans la paperasse.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── AVANT / AVEC (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Pourquoi Audit+</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Fini les grilles papier et les rapports retapés le soir</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-black/[0.06] bg-[#FAFAFA] p-7">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#78716C]">Avant</div>
              <ul className="mt-5 space-y-3.5">
                {['Des grilles papier remplies à la main', 'Des photos éparpillées sur plusieurs téléphones', 'Des rapports retapés le soir', 'Un DUERP qui repart de zéro'].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[#57534E]">
                    <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-black/[0.05] flex items-center justify-center"><X className="h-3 w-3 text-[#A8A29E]" /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="h-full rounded-3xl bg-[#205040] p-7 text-white shadow-xl shadow-[#205040]/20">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#5CD9A0]">Avec Audit+</div>
              <ul className="mt-5 space-y-3.5">
                {['Une grille guidée, domaine par domaine', 'Les photos preuves rangées dans l’audit', 'Le rapport PDF prêt en un clic', 'Un DUERP pré-rempli pour votre métier, à ajuster'].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-white/90">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5CD9A0]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TROIS OUTILS (clair, fond gris) ── */}
      <section className="bg-[#FAFAFA] border-y border-[#205040]/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="max-w-2xl">
            <Kicker className="mb-4">Trois outils, une application</Kicker>
            <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">Hygiène, sécurité et allergènes, au même endroit</h2>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {OUTILS.map((o, i) => (
              <Reveal key={o.nom} delay={i * 80}>
                <div className="h-full rounded-3xl border border-black/[0.06] bg-white p-7 hover:shadow-lg hover:shadow-black/5 ll-lift">
                  <span className={`h-12 w-12 rounded-2xl ${o.fond} flex items-center justify-center`} style={{ color: o.teinte }}>
                    <o.Icon className="h-6 w-6" />
                  </span>
                  <div className="mt-5 font-heading font-bold text-lg text-[#14110F]" style={{ color: o.teinte }}>{o.nom}</div>
                  <ul className="mt-4 space-y-2.5">
                    {o.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-[#57534E] leading-relaxed">
                        <span className="mt-0.5 shrink-0" style={{ color: o.teinte }}><CheckCircle2 className="h-4 w-4" /></span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  {o.ia && (
                    <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#205040]/8 px-3 py-1 text-xs font-semibold text-[#205040]">
                      <Sparkles className="h-3 w-3" /> Lecture d’étiquette par l’IA, toujours validée par un humain
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── LA PROGRESSION MESURÉE (sombre) ── */}
      <section className="relative overflow-hidden bg-[#0C1210] text-white">
        <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(700px 400px at 85% 0%, rgba(92,217,160,0.14), transparent 55%), radial-gradient(600px 350px at 0% 100%, rgba(56,197,136,0.10), transparent 55%)' }} />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            {kickerSombre('Entrée, sortie')}
            <h2 className="mt-5 ll-display ll-fluid-h2 text-white text-balance">La progression, mesurée</h2>
            <p className="mt-4 text-lg text-white/65 leading-relaxed">
              Lors de nos formations hygiène, un audit d’entrée cible ce qu’il faut travailler, puis un
              audit de sortie mesure ce qui a changé. Les deux figurent dans le compte rendu de formation.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {CHIFFRES.map((c) => (
                <div key={c.l} className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4">
                  <div className="font-heading font-black text-2xl md:text-3xl text-white tabular-nums">{c.v}</div>
                  <div className="mt-1 text-xs text-white/70 leading-snug">{c.l}</div>
                  <div className="mt-1 text-[11px] text-white/40 leading-snug">{c.d}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6">
            <Reveal>
              <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-7 md:p-8">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#5CD9A0]">Score moyen sur 100</div>
                <div className="mt-6 space-y-5">
                  {[{ l: 'Premier audit', v: 60, c: 'bg-white/30' }, { l: 'Dernier audit', v: 79, c: 'bg-[#5CD9A0]' }].map((b) => (
                    <div key={b.l}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-white/70">{b.l}</span>
                        <span className="font-heading font-black text-2xl text-white tabular-nums">{b.v}</span>
                      </div>
                      <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${b.c}`} style={{ width: `${b.v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm text-white/60 leading-relaxed">
                  <span className="font-semibold text-white">+19 points en moyenne,</span> et 32 établissements sur 34 en
                  progression, parmi ceux audités au moins deux fois.
                </p>
                <p className="mt-2 text-[11px] text-white/35">Audits réalisés avec Audit+ entre mars et septembre 2026.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PENSÉ POUR LE TERRAIN (clair) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          <Kicker className="mb-4">Pensé pour le terrain</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-[#14110F] text-balance">En cuisine, en réserve, au comptoir</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TERRAIN.map((c, i) => (
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

      {/* ── CTA (sombre) ── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-20 md:pb-24">
        <Reveal>
          <div className="rounded-[32px] bg-[#0C1210] text-white px-6 md:px-16 py-16 md:py-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-80" style={{ background: 'radial-gradient(600px 300px at 20% 0%, rgba(92,217,160,0.20), transparent 60%), radial-gradient(500px 260px at 100% 100%, rgba(56,197,136,0.14), transparent 55%)' }} />
            <div className="relative">
              {kickerSombre('Audit+ by Lab Learning')}
              <h2 className="mt-6 ll-display ll-fluid-h1 text-balance max-w-3xl mx-auto text-white">L’audit terrain, sans la paperasse</h2>
              <p className="mt-4 text-white/60 max-w-xl mx-auto text-lg">
                Nous vous montrons Audit+ sur un cas concret de votre métier : audit hygiène, DUERP ou allergènes.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/site/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#5CD9A0] text-[#0C1210] text-sm font-semibold hover:bg-[#38C588] ll-lift">
                  Demander une démo <ArrowRight className="h-4 w-4" />
                </Link>
                <a href={DEMO_WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/25 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                  <Whatsapp className="h-4 w-4" /> Nous écrire sur WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
