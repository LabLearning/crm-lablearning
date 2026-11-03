import { Home, BookOpen, Ranking, UserCircle, Bell, Flame, Award, Play } from '../icons'

// Visuels de la page e-learning : la fenêtre de navigateur qui encadre une
// capture de Learnexa, et le téléphone de l'apprenant. Les animations sont en
// CSS (classes ll-el-* de globals.css) : rien à charger, rien à hydrater.

/** Capture de la plateforme dans une fenêtre de navigateur. */
export function Fenetre({ src, alt, adresse = 'learnexa.fr', largeur = 1400, hauteur = 788, children }: {
  src: string; alt: string; adresse?: string; largeur?: number; hauteur?: number; children?: React.ReactNode
}) {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl bg-[#0F172A] ring-1 ring-white/15 shadow-2xl shadow-black/50">
        <div className="flex h-9 items-center gap-1.5 bg-white/[0.06] px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="ml-3 rounded-md bg-white/[0.07] px-3 py-0.5 text-[11px] text-white/50">{adresse}</span>
        </div>
        <img src={src} alt={alt} width={largeur} height={hauteur} className="block w-full" />
      </div>
      {children}
    </div>
  )
}

const PARCOURS = [
  { titre: 'Hygiène en cuisine', part: 82 },
  { titre: 'Sécurité incendie', part: 45 },
  { titre: 'Service en salle', part: 12 },
]

const ONGLETS = [
  { Icon: Home, label: 'Accueil', actif: true },
  { Icon: BookOpen, label: 'Parcours' },
  { Icon: Ranking, label: 'Classement' },
  { Icon: UserCircle, label: 'Profil' },
]

/** Barre d'état d'iPhone : réseau, wifi, batterie (dessins, pas des icônes de contenu). */
function BarreEtat() {
  return (
    <div className="relative flex h-[46px] shrink-0 items-end justify-between px-7 pb-2 text-[#0F172A]">
      <span className="text-[13px] font-semibold tabular-nums tracking-tight">9:41</span>
      {/* Dynamic Island */}
      <span aria-hidden className="absolute left-1/2 top-[11px] h-[28px] w-[94px] -translate-x-1/2 rounded-full bg-[#05070C]" />
      <span aria-hidden className="flex items-center gap-[5px]">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.8" /><rect x="4.6" y="5" width="3" height="6" rx="0.8" /><rect x="9.2" y="2.6" width="3" height="8.4" rx="0.8" /><rect x="13.8" y="0" width="3" height="11" rx="0.8" /></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2.2c2.1 0 4 .8 5.5 2.1l1.1-1.2A9.6 9.6 0 0 0 7.5.5 9.6 9.6 0 0 0 .9 3.1L2 4.3a8 8 0 0 1 5.5-2.1Z" /><path d="M7.5 5.4c1.2 0 2.3.4 3.2 1.2l1.1-1.2a6.3 6.3 0 0 0-8.6 0l1.1 1.2c.9-.8 2-1.2 3.2-1.2Z" /><path d="m7.5 10.6 2-2.2a3 3 0 0 0-4 0l2 2.2Z" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" strokeOpacity="0.4" /><rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" /><path d="M23 4v4c.8-.3 1.3-1.1 1.3-2S23.8 4.3 23 4Z" fill="currentColor" fillOpacity="0.45" /></svg>
      </span>
    </div>
  )
}

/**
 * Le téléphone de l'apprenant, aux proportions d'un iPhone (71,6 × 147,6 mm).
 * L'écran reprend la vraie interface de Learnexa en version mobile : bandeau de
 * bienvenue avec le robot, niveau et XP, quête du jour, série, badges et
 * parcours. N'affiche que ce que la page annonce (points, niveaux, badges,
 * séries, quêtes, classement).
 */
export function TelephoneApprenant() {
  return (
    <div className="relative mx-auto w-[292px] max-w-full sm:w-[320px]">
      {/* Halo de couleur derrière l'appareil */}
      <div aria-hidden className="pointer-events-none absolute -inset-x-20 -inset-y-12 -z-10 bg-[radial-gradient(closest-side,rgba(82,113,255,0.20),rgba(34,211,238,0.08)_55%,transparent)]" />

      {/* Boutons latéraux : action, volume, puis alimentation */}
      <span aria-hidden className="absolute -left-[3px] top-[17%] h-[26px] w-[4px] rounded-l-md bg-gradient-to-b from-[#3B4256] to-[#1A2033]" />
      <span aria-hidden className="absolute -left-[3px] top-[24.5%] h-[50px] w-[4px] rounded-l-md bg-gradient-to-b from-[#3B4256] to-[#1A2033]" />
      <span aria-hidden className="absolute -left-[3px] top-[33%] h-[50px] w-[4px] rounded-l-md bg-gradient-to-b from-[#3B4256] to-[#1A2033]" />
      <span aria-hidden className="absolute -right-[3px] top-[27%] h-[78px] w-[4px] rounded-r-md bg-gradient-to-b from-[#3B4256] to-[#1A2033]" />

      {/* Cadre titane */}
      <div className="relative aspect-[716/1476] rounded-[54px] bg-gradient-to-br from-[#4A5168] via-[#1C2236] to-[#0B1020] p-[3px] shadow-[0_50px_90px_-30px_rgba(15,23,42,0.55),0_25px_40px_-25px_rgba(82,113,255,0.35)]">
        <div className="h-full rounded-[51px] bg-[#07090F] p-[9px]">
          {/* Écran */}
          <div className="relative flex h-full flex-col overflow-hidden rounded-[42px] bg-[#F4F6FB]">
            <BarreEtat />

            <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 pt-1.5">
              {/* Barre de l'appli */}
              <div className="flex items-center justify-between">
                <img src="/site/logos/learnexa.svg" alt="Learnexa" width={114} height={27} className="h-[18px] w-auto" />
                <div className="flex items-center gap-2">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                    <Bell className="h-4 w-4 text-[#334155]" />
                    <span className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#F43F5E] ring-2 ring-white" />
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5271FF] font-heading text-[11px] font-bold text-white">SB</span>
                </div>
              </div>

              {/* Bandeau de bienvenue, comme sur l'appli */}
              <div className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#171A3F_0%,#262A6B_55%,#3B3FA8_100%)] p-4 text-white">
                <span aria-hidden className="absolute left-[46%] top-3 h-[3px] w-[3px] rounded-full bg-white/50" />
                <span aria-hidden className="absolute left-[62%] top-9 h-[2px] w-[2px] rounded-full bg-white/40" />
                <span aria-hidden className="absolute left-[38%] bottom-4 h-[2px] w-[2px] rounded-full bg-white/30" />
                <img src="/site/photos/learnexa/evaluateur.webp" alt="" width={320} height={320} className="ll-el-flotte absolute -right-3 -top-1 h-[86px] w-[86px]" />
                <div className="pr-16">
                  <div className="font-heading text-[16px] font-bold leading-tight">Hey Sarah !</div>
                  <div className="mt-0.5 text-[11px] text-white/65">Prête à reprendre ?</div>
                </div>
                <div className="mt-4 flex items-center gap-2.5">
                  <img src="/site/photos/learnexa/niveau-3.webp" alt="" width={172} height={174} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold">Niveau 12</span>
                      <span className="text-[10px] tabular-nums text-white/55">1 240 / 1 500 XP</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full w-[83%]"><div className="ll-el-barre h-full w-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#818CF8]" /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quête du jour */}
              <div className="rounded-[18px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5271FF]">Quête du jour</span>
                  <span className="rounded-full bg-[#5271FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#5271FF]">+50 XP</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug text-[#0F172A]">Termine le chapitre HACCP</div>
                    <div className="mt-0.5 text-[10px] text-[#64748B]">2 leçons sur 3</div>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5271FF] to-[#7C3AED] text-white shadow-md shadow-[#5271FF]/30">
                    <Play className="h-4 w-4" />
                  </span>
                </div>
              </div>

              {/* Classement et badges */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2 rounded-[16px] bg-white p-2.5 shadow-sm ring-1 ring-black/5 sm:gap-2.5 sm:p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ECFEFF] text-[#0891B2]"><Ranking className="h-4 w-4" /></span>
                  <div className="whitespace-nowrap leading-tight">
                    <div className="text-[13px] font-bold text-[#0F172A]">2<sup className="text-[8px]">e</sup></div>
                    <div className="text-[10px] text-[#64748B]">de l’équipe</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-[16px] bg-white p-2.5 shadow-sm ring-1 ring-black/5 sm:gap-2.5 sm:p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-[#5271FF]"><Award className="h-4 w-4" /></span>
                  <div className="whitespace-nowrap leading-tight">
                    <div className="text-[13px] font-bold text-[#0F172A]">4 / 6</div>
                    <div className="text-[10px] text-[#64748B]">badges</div>
                  </div>
                </div>
              </div>

              {/* Parcours */}
              <div className="rounded-[18px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
                <div className="text-[12px] font-bold text-[#0F172A]">Mes parcours</div>
                <div className="mt-2.5 space-y-2.5">
                  {PARCOURS.map((p, i) => (
                    <div key={p.titre}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[#334155]">{p.titre}</span>
                        <span className="tabular-nums text-[#64748B]">{p.part} %</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div className="h-full" style={{ width: `${p.part}%` }}>
                          <div className="ll-el-barre h-full w-full rounded-full bg-gradient-to-r from-[#5271FF] to-[#22D3EE]" style={{ animationDelay: `${0.25 + i * 0.2}s` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Onglets et barre d'accueil */}
            <div className="relative shrink-0 border-t border-black/5 bg-white/95 px-5 pb-6 pt-2">
              <div className="flex items-center justify-between">
                {ONGLETS.map((o) => (
                  <span key={o.label} className={`flex w-14 flex-col items-center gap-0.5 text-[9px] font-semibold ${o.actif ? 'text-[#5271FF]' : 'text-[#94A3B8]'}`}>
                    <o.Icon className="h-[19px] w-[19px]" />
                    {o.label}
                  </span>
                ))}
              </div>
              <span aria-hidden className="absolute bottom-[7px] left-1/2 h-[5px] w-[108px] -translate-x-1/2 rounded-full bg-[#0F172A]" />
            </div>
          </div>
        </div>
      </div>

      {/* Pastilles flottantes */}
      {/* Aux coins de l'appareil, sur la barre d'état et les onglets : elles ne cachent rien de l'écran */}
      <div className="ll-el-flotte-lent absolute -right-20 -top-5 hidden rounded-2xl bg-white px-3.5 py-3 shadow-xl shadow-black/10 ring-1 ring-black/5 sm:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF4E5] text-[#F97316]"><Flame className="h-4 w-4" /></span>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Série</div>
            <div className="font-heading text-base font-bold text-[#0F172A]">7 jours</div>
          </div>
        </div>
        <div aria-hidden className="mt-2.5 flex gap-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
            <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold ${i < 6 ? 'bg-[#F97316] text-white' : 'bg-[#FFF4E5] text-[#F97316] ring-1 ring-[#F97316]/40'}`}>{j}</span>
          ))}
        </div>
      </div>
      <div className="ll-el-flotte absolute -left-20 bottom-[3%] hidden items-center gap-3 rounded-2xl bg-[#0B1222] py-2.5 pl-2.5 pr-4 text-white shadow-xl shadow-black/25 sm:flex lg:-left-24">
        <img src="/site/photos/learnexa/niveau-2.webp" alt="" width={172} height={172} className="h-10 w-10" />
        <div className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#22D3EE]">Badge obtenu</div>
          <div className="font-heading text-sm font-bold">Hygiène des mains</div>
        </div>
      </div>
    </div>
  )
}
