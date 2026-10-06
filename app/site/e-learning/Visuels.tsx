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

/** Le téléphone de l'apprenant : niveau, quête du jour, progression par parcours. */
export function TelephoneApprenant() {
  return (
    <div className="relative mx-auto w-[280px] max-w-full">
      <div className="rounded-[42px] bg-[#0B1222] p-2.5 ring-1 ring-black/10 shadow-2xl shadow-[#0B1222]/40">
        <div className="overflow-hidden rounded-[34px] bg-white">
          <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold text-[#0F172A]">
            <span>9:41</span>
            <span className="h-5 w-20 rounded-full bg-[#0B1222]" />
            <span className="h-2.5 w-5 rounded-sm border border-[#0F172A]/50" />
          </div>
          <div className="px-5 pb-6 pt-4">
            <img src="/site/logos/learnexa.svg" alt="Learnexa" width={114} height={27} className="h-5 w-auto" />
            <div className="mt-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5271FF] font-heading text-sm font-bold text-white">SB</span>
              <div className="min-w-0 flex-1">
                <div className="font-heading text-sm font-bold text-[#0F172A]">Sarah</div>
                <div className="text-xs text-[#64748B]">Niveau 12</div>
              </div>
              <img src="/site/photos/learnexa/niveau-3.webp" alt="" width={176} height={176} className="h-10 w-10 ll-el-flotte" />
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#5271FF] to-[#7C3AED] p-4 text-white">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Quête du jour</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold leading-snug">Termine le chapitre HACCP</span>
                <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">+50 XP</span>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {PARCOURS.map((p, i) => (
                <div key={p.titre}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">{p.titre}</span>
                    <span className="tabular-nums text-[#64748B]">{p.part} %</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                    <div className="h-full" style={{ width: `${p.part}%` }}>
                      <div className="ll-el-barre h-full w-full rounded-full bg-gradient-to-r from-[#5271FF] to-[#22D3EE]" style={{ animationDelay: `${0.25 + i * 0.2}s` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Pastilles flottantes */}
      <div className="ll-el-flotte-lent absolute left-[calc(100%-1.5rem)] top-20 hidden whitespace-nowrap rounded-2xl bg-white px-3.5 py-2.5 shadow-xl shadow-black/15 ring-1 ring-black/5 sm:block">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Série</div>
        <div className="font-heading text-lg font-bold text-[#0F172A]">7 jours</div>
      </div>
      <div className="ll-el-flotte absolute right-[calc(100%-1.5rem)] bottom-16 hidden whitespace-nowrap rounded-2xl bg-[#0B1222] px-3.5 py-2.5 text-white shadow-xl shadow-black/25 sm:block">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#22D3EE]">Badge obtenu</div>
        <div className="font-heading text-sm font-bold">Hygiène des mains</div>
      </div>
    </div>
  )
}
