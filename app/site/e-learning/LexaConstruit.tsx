'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Sparkles } from '../icons'

/**
 * « Décrivez, Lexa construit » : la séquence de la page d'accueil de Learnexa,
 * rejouée ici. La demande s'écrit, Lexa réfléchit, les modules arrivent un à
 * un, la formation est publiée, puis la séquence recommence. Elle ne démarre
 * qu'à l'écran et s'affiche d'emblée terminée si le visiteur a demandé moins
 * d'animations.
 */
const DEMANDE = 'Crée une formation Hygiène HACCP, 45 min, niveau opérateur'
const MODULES = [
  { n: '1', titre: 'Risques alimentaires', detail: '3 chapitres · 8 min' },
  { n: '2', titre: 'Méthode HACCP', detail: '5 chapitres · 14 min' },
  { n: '3', titre: 'Bonnes pratiques', detail: '4 chapitres · 11 min' },
  { n: '✓', titre: 'Évaluation finale', detail: '3 min' },
]
// Étapes : 0 saisie · 1 réflexion · 2 à 5 modules · 6 publiée
const FIN = 6

export function LexaConstruit() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [calme, setCalme] = useState(false)
  const [lettres, setLettres] = useState(0)
  const [etape, setEtape] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setCalme(true); setLettres(DEMANDE.length); setEtape(FIN); return }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (calme || !visible) return
    let delai: number
    if (etape === 0 && lettres < DEMANDE.length) delai = window.setTimeout(() => setLettres((x) => x + 1), 32)
    else if (etape === 0) delai = window.setTimeout(() => setEtape(1), 500)
    else if (etape === 1) delai = window.setTimeout(() => setEtape(2), 1500)
    else if (etape < FIN) delai = window.setTimeout(() => setEtape((x) => x + 1), 650)
    else delai = window.setTimeout(() => { setLettres(0); setEtape(0) }, 5200)
    return () => window.clearTimeout(delai)
  }, [visible, calme, lettres, etape])

  const modulesVus = Math.max(0, Math.min(MODULES.length, etape - 1))

  return (
    <div ref={ref} className="rounded-[28px] bg-white/[0.04] ring-1 ring-white/10 p-4 sm:p-6" aria-label="Démonstration : Lexa construit une formation à partir d’une phrase">
      {/* La demande */}
      <div className="rounded-2xl bg-[#0B1222] ring-1 ring-white/10 px-4 py-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Votre demande</div>
        <div className="mt-1 min-h-[3rem] sm:min-h-[1.6rem] text-[15px] leading-relaxed text-white">
          {DEMANDE.slice(0, lettres)}
          {etape === 0 && <span className="ll-el-curseur ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] bg-[#22D3EE]" />}
        </div>
      </div>

      {/* Lexa répond */}
      <div className="mt-4 flex items-start gap-3">
        <img src="/site/photos/learnexa/architecte.webp" alt="" width={320} height={320} className={`h-11 w-11 shrink-0 rounded-full bg-white/10 ${etape >= 1 && etape < FIN ? 'll-el-flotte' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            Lexa <span className="rounded-full bg-[#5271FF]/20 px-2 py-0.5 text-[11px] font-semibold text-[#A8B8FF]">Architecte pédagogique</span>
          </div>
          <div className="mt-1 min-h-[1.4rem] text-sm text-white/65">
            {etape === 0 && <span className="text-white/35">En attente de votre demande…</span>}
            {etape === 1 && <span className="inline-flex items-center gap-1.5 text-[#22D3EE]"><Sparkles className="h-3.5 w-3.5" /> Lexa réfléchit…</span>}
            {etape >= 2 && 'Voici la structure que je vous propose. Vous pouvez ajuster, régénérer ou valider chaque module.'}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MODULES.map((m, i) => (
              <div key={m.titre} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-all duration-500 ${i < modulesVus ? 'bg-white/[0.07] ring-white/15 opacity-100 translate-y-0' : 'bg-transparent ring-white/5 opacity-25 translate-y-1'}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#5271FF]/25 text-xs font-bold text-white">{m.n}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{m.titre}</span>
                  <span className="block text-xs text-white/50">{m.detail}</span>
                </span>
              </div>
            ))}
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3.5 py-3 ring-1 transition-all duration-500 ${etape >= FIN ? 'bg-[#22D3EE]/10 ring-[#22D3EE]/40 opacity-100' : 'ring-white/5 opacity-25'}`}>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4 text-[#22D3EE]" /> Formation publiée</span>
            <span className="text-xs tabular-nums text-white/60">4 modules · 18 chapitres · 24 questions</span>
          </div>
        </div>
      </div>
    </div>
  )
}
