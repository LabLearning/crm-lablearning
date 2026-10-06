'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, X, Sparkles } from '../icons'

/**
 * Démonstration jouable de la page e-learning : trois questions d'hygiène,
 * des points à gagner, une explication après chaque réponse. Tout se passe
 * dans le navigateur ; rien n'est enregistré. Les réponses sont celles des
 * textes cités dans nos guides (arrêté du 21 décembre 2009, règlement
 * n° 1169/2011, décret n° 2008-184).
 */
const QUESTIONS = [
  {
    theme: 'Températures',
    q: 'À quelle température, au plus, se conserve la viande hachée ?',
    options: ['+2 °C', '+4 °C', '+8 °C'],
    bonne: 0,
    explication: 'La viande hachée fait partie des denrées les plus fragiles : +2 °C au plus. La plupart des autres viandes se conservent à +4 °C au plus.',
    lien: { href: '/modeles/releve-temperatures-restaurant', libelle: 'Le relevé de températures à imprimer' },
  },
  {
    theme: 'Allergènes',
    q: 'Combien d’allergènes devez-vous signaler à vos clients ?',
    options: ['8', '14', '20'],
    bonne: 1,
    explication: 'Quatorze, dès qu’ils entrent dans la recette d’un plat : gluten, œufs, lait, arachides, fruits à coque, sésame et huit autres.',
    lien: { href: '/modeles/tableau-allergenes-restaurant', libelle: 'Le tableau des allergènes à imprimer' },
  },
  {
    theme: 'Friture',
    q: 'Au-delà de quel taux de composés polaires une huile de friture ne doit-elle plus être utilisée ?',
    options: ['15 %', '25 %', '40 %'],
    bonne: 1,
    explication: 'Au-delà de 25 %, l’huile est réputée impropre à la consommation : le bain est changé.',
    lien: { href: '/modeles/suivi-huiles-friture-restaurant', libelle: 'La fiche de suivi des huiles à imprimer' },
  },
]
const POINTS = 50
const SEUIL_NIVEAU = 100

export function QuizDemo() {
  const [n, setN] = useState(0)
  const [choix, setChoix] = useState<number | null>(null)
  const [xp, setXp] = useState(0)
  const [serie, setSerie] = useState(0)
  const [fini, setFini] = useState(false)

  const question = QUESTIONS[n]
  const juste = choix !== null && choix === question.bonne
  const niveau = xp >= SEUIL_NIVEAU ? 2 : 1
  const jauge = Math.min(100, Math.round((xp / (QUESTIONS.length * POINTS)) * 100))

  function repondre(i: number) {
    if (choix !== null) return
    setChoix(i)
    if (i === question.bonne) { setXp((x) => x + POINTS); setSerie((s) => s + 1) } else setSerie(0)
  }
  function suivante() {
    if (n + 1 >= QUESTIONS.length) { setFini(true); return }
    setN((x) => x + 1); setChoix(null)
  }
  function rejouer() { setN(0); setChoix(null); setXp(0); setSerie(0); setFini(false) }

  return (
    <div className="relative rounded-[28px] bg-[#0B1222] text-white ring-1 ring-white/10 shadow-2xl shadow-[#0B1222]/30 overflow-hidden">
      <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(500px 260px at 0% 0%, rgba(82,113,255,0.28), transparent 60%), radial-gradient(420px 240px at 100% 100%, rgba(34,211,238,0.16), transparent 55%)' }} />
      <div className="relative p-5 sm:p-7">
        {/* Barre du joueur : niveau, points, série */}
        <div className="flex items-center gap-3">
          <img src={`/site/photos/learnexa/niveau-${niveau}.webp`} alt="" width={176} height={176} className="h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-white/90">Niveau {niveau}</span>
              <span className="relative tabular-nums text-white/60">
                {xp} XP
                {choix !== null && juste && <span key={`gain-${n}`} className="ll-el-gain absolute -top-1 right-0 whitespace-nowrap font-bold text-[#22D3EE]">+{POINTS} XP</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#5271FF] to-[#22D3EE] transition-[width] duration-700 ease-out" style={{ width: `${jauge}%` }} />
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.07] ring-1 ring-white/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-white/80" aria-label={`Série de ${serie} bonnes réponses`}>
            Série {serie}
          </span>
        </div>

        {fini ? (
          <div key="fin" className="ll-el-entree mt-8 text-center">
            <img src={`/site/photos/learnexa/niveau-${niveau === 2 ? 3 : 1}.webp`} alt="" width={176} height={176} className="mx-auto h-24 w-24 ll-el-flotte" />
            <h3 className="mt-4 font-heading text-2xl font-bold text-white">
              {xp >= SEUIL_NIVEAU ? 'Niveau 2 débloqué' : 'Fin de la partie'}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/65">
              {xp} XP sur {QUESTIONS.length * POINTS}. Sur Learnexa, chaque module se termine ainsi : des points, un niveau, et l’envie de lancer le suivant.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={rejouer} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/5 transition-colors">
                Rejouer
              </button>
              <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#5271FF] px-5 text-sm font-semibold text-white hover:bg-[#4460E6] transition-colors">
                En parler avec nous <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div key={n} className="ll-el-entree mt-7">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#22D3EE]">{question.theme}</span>
              <span className="tabular-nums text-white/50">Question {n + 1} sur {QUESTIONS.length}</span>
            </div>
            <h3 className="mt-3 font-heading text-lg sm:text-xl font-semibold leading-snug text-balance text-white">{question.q}</h3>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {question.options.map((o, i) => {
                const etat = choix === null ? 'libre' : i === question.bonne ? 'bonne' : i === choix ? 'fausse' : 'autre'
                return (
                  <button key={o} type="button" onClick={() => repondre(i)} disabled={choix !== null}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold tabular-nums transition-all ${
                      etat === 'libre' ? 'bg-white/[0.06] ring-1 ring-white/15 hover:bg-white/[0.12] hover:ring-[#5271FF]/70'
                        : etat === 'bonne' ? 'bg-[#22D3EE]/15 ring-2 ring-[#22D3EE] text-white'
                          : etat === 'fausse' ? 'bg-[#F87171]/10 ring-2 ring-[#F87171]/70 text-white/80'
                            : 'bg-white/[0.03] ring-1 ring-white/10 text-white/35'
                    }`}>
                    {etat === 'bonne' && <CheckCircle2 className="h-4 w-4 text-[#22D3EE]" />}
                    {etat === 'fausse' && <X className="h-4 w-4 text-[#F87171]" />}
                    {o}
                  </button>
                )
              })}
            </div>

            {choix !== null && (
              <div className="ll-el-entree mt-5 rounded-2xl bg-white/[0.05] ring-1 ring-white/10 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">
                  <Sparkles className="h-3.5 w-3.5" /> {juste ? 'Bonne réponse' : 'L’explication'}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/80">{question.explication}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <Link href={question.lien.href} className="text-sm font-semibold text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">
                    {question.lien.libelle}
                  </Link>
                  <button type="button" onClick={suivante} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#5271FF] px-5 text-sm font-semibold text-white hover:bg-[#4460E6] transition-colors">
                    {n + 1 >= QUESTIONS.length ? 'Voir mon résultat' : 'Question suivante'} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
