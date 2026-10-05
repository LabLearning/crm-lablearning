'use client'

import { useMemo, useState } from 'react'
import { Search } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { montantFr } from '@/lib/tresorerie'

export interface LigneMouvement {
  id: string
  /** « AAAA-MM-JJ », heure de Paris. */
  jour: string
  montant: number
  sens: 'credit' | 'debit'
  tiers: string
  detail: string
  compte: string
  interne: boolean
}

const PAS = 60
const SENS = [
  { valeur: 'tous', label: 'Tout' },
  { valeur: 'credit', label: 'Entrées' },
  { valeur: 'debit', label: 'Sorties' },
] as const

const jourCourt = (j: string) => `${j.slice(8, 10)}/${j.slice(5, 7)}`
const sansAccent = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Les mouvements de la période : recherche, sens, compte, et virements internes masqués par défaut. */
export function MouvementsTable({ lignes, comptes, tronque }: { lignes: LigneMouvement[]; comptes: string[]; tronque: boolean }) {
  const [recherche, setRecherche] = useState('')
  const [sens, setSens] = useState<(typeof SENS)[number]['valeur']>('tous')
  const [compte, setCompte] = useState('')
  const [internes, setInternes] = useState(false)
  const [limite, setLimite] = useState(PAS)

  const filtrees = useMemo(() => {
    const q = sansAccent(recherche.trim())
    return lignes.filter((l) =>
      (internes || !l.interne)
      && (sens === 'tous' || l.sens === sens)
      && (!compte || l.compte === compte)
      && (!q || sansAccent(`${l.tiers} ${l.detail}`).includes(q)))
  }, [lignes, recherche, sens, compte, internes])
  const visibles = filtrees.slice(0, limite)
  const nbInternes = useMemo(() => lignes.filter((l) => l.interne).length, [lignes])

  return (
    <section className="card overflow-hidden" aria-labelledby="mouvements-titre">
      <div className="p-4 sm:p-5 border-b border-surface-200/70 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="mouvements-titre" className="font-heading font-semibold text-surface-900">Mouvements</h2>
          <p className="text-xs text-surface-500 tabular-nums">
            {filtrees.length} {filtrees.length > 1 ? 'mouvements' : 'mouvement'}
            {tronque && ' · les plus récents seulement'}
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Rechercher un mouvement</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setLimite(PAS) }}
              placeholder="Rechercher un tiers, une référence"
              className="input-base !min-h-10 !py-2 !pl-9 w-full"
            />
          </label>
          <div role="group" aria-label="Sens" className="inline-flex rounded-lg bg-surface-100 p-0.5 self-start">
            {SENS.map((s) => (
              <button
                key={s.valeur}
                type="button"
                aria-pressed={sens === s.valeur}
                onClick={() => { setSens(s.valeur); setLimite(PAS) }}
                className={cn('min-h-9 rounded-md px-3 text-xs font-semibold transition-colors', sens === s.valeur ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-800')}
              >
                {s.label}
              </button>
            ))}
          </div>
          {comptes.length > 1 && (
            <label className="min-w-0">
              <span className="sr-only">Compte</span>
              <select value={compte} onChange={(e) => { setCompte(e.target.value); setLimite(PAS) }} className="input-base !min-h-10 !py-2 w-full lg:w-52">
                <option value="">Tous les comptes</option>
                {comptes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {nbInternes > 0 && (
            <label className="flex items-center gap-2 text-xs text-surface-600 cursor-pointer min-h-10 whitespace-nowrap">
              <input type="checkbox" checked={internes} onChange={(e) => { setInternes(e.target.checked); setLimite(PAS) }} className="h-4 w-4 rounded border-surface-300" />
              Virements entre vos comptes ({nbInternes})
            </label>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="p-6 text-sm text-surface-500 text-center">Aucun mouvement ne correspond à ces filtres.</p>
      ) : (
        <ul className="divide-y divide-surface-100">
          {visibles.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <span className="w-11 shrink-0 font-mono text-xs tabular-nums text-surface-400">{jourCourt(l.jour)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-surface-800">
                  {l.tiers}
                  {l.interne && <span className="ml-2 rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-500">Interne</span>}
                </span>
                <span className="block truncate text-xs text-surface-400">{[l.detail, l.compte].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={cn('shrink-0 font-mono text-sm tabular-nums', l.sens === 'credit' ? 'font-semibold text-brand-600' : 'text-surface-800')}>
                {l.sens === 'credit' ? '+' : '−'}{montantFr(l.montant, 2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {filtrees.length > limite && (
        <div className="border-t border-surface-100 p-3 text-center">
          <button type="button" onClick={() => setLimite((n) => n + PAS * 2)} className="btn-secondary !py-2 text-sm min-h-10">
            Afficher {Math.min(PAS * 2, filtrees.length - limite)} mouvements de plus
          </button>
        </div>
      )}
    </section>
  )
}
