'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, X } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export interface OptionChoix {
  value: string
  label: string
  /** Complément affiché à droite (un nombre, en général) */
  detail?: string
}

/** Texte comparable : sans accents ni ponctuation (« Saint-Jean » et « saint jean » se rejoignent) */
const normaliser = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Choix multiple avec recherche, pour les longues listes (villes, formations,
 * secteurs…) : les valeurs choisies en puces, la liste filtrée à la frappe,
 * au clavier comme à la souris (flèches, Entrée, Retour arrière, Échap).
 * `cleRecherche` : la même mise en forme que les valeurs (une ville tapée
 * « st jean » retrouve « Saint-Jean-de-Védas »).
 */
export function ChoixMultiples({
  options, valeurs, onChange, placeholder = 'Rechercher…', vide = 'Aucun résultat', disabled, id, label, cleRecherche,
}: {
  options: OptionChoix[]
  valeurs: string[]
  onChange: (valeurs: string[]) => void
  placeholder?: string
  /** Texte quand la recherche ne trouve rien */
  vide?: string
  disabled?: boolean
  id?: string
  /** Nom accessible du champ, quand aucun libellé visible ne le porte */
  label?: string
  cleRecherche?: (texte: string) => string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [actif, setActif] = useState(0)
  const racine = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const idListe = useId()
  const idOption = (i: number) => `${idListe}-${i}`

  const parValeur = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  const choisies = useMemo(() => new Set(valeurs), [valeurs])
  const filtrees = useMemo(() => {
    const q = normaliser(recherche)
    if (!q) return options.slice(0, 80)
    const k = cleRecherche ? cleRecherche(recherche) : ''
    return options.filter((o) => normaliser(o.label).includes(q) || (!!k && o.value.includes(k))).slice(0, 80)
  }, [options, recherche, cleRecherche])

  const fermer = () => { setOuvert(false); setRecherche(''); setActif(0) }
  useEffect(() => { setActif(0) }, [recherche])
  // Fermeture au clic en dehors
  useEffect(() => {
    const clic = (e: MouseEvent) => { if (racine.current && !racine.current.contains(e.target as Node)) fermer() }
    document.addEventListener('mousedown', clic)
    return () => document.removeEventListener('mousedown', clic)
  }, [])
  // L'option active reste visible quand on la déplace au clavier
  useEffect(() => {
    if (ouvert) document.getElementById(idOption(actif))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, actif])

  const basculer = (v: string) => onChange(choisies.has(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v])

  return (
    <div
      ref={racine}
      className="relative"
      // Le focus part ailleurs (Tab, autre champ) : la liste se ferme
      onBlur={(e) => { if (!racine.current?.contains(e.relatedTarget as Node | null)) fermer() }}
    >
      <div
        className={cn('input-base flex min-h-[2.5rem] w-full cursor-text flex-wrap items-center gap-1.5 !py-1.5 focus-within:ring-2 focus-within:ring-brand-300',
          disabled && 'cursor-default opacity-60')}
        onClick={() => { if (!disabled) { setOuvert(true); champ.current?.focus() } }}
      >
        {valeurs.map((v) => (
          <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-700">
            <span className="truncate">{parValeur.get(v)?.label || v}</span>
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); basculer(v) }} aria-label={`Retirer ${parValeur.get(v)?.label || v}`}
                className="rounded-full p-0.5 text-brand-600 hover:bg-brand-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={champ}
          id={id}
          value={recherche}
          disabled={disabled}
          onChange={(e) => { setRecherche(e.target.value); setOuvert(true) }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') fermer()
            else if (e.key === 'ArrowDown') { e.preventDefault(); setOuvert(true); setActif((i) => Math.min(i + 1, Math.max(filtrees.length - 1, 0))) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); const o = filtrees[actif]; if (ouvert && o) { basculer(o.value); setRecherche('') } }
            // Touche maintenue : le texte s'efface, pas toutes les puces
            else if (e.key === 'Backspace' && !e.repeat && !recherche && valeurs.length) onChange(valeurs.slice(0, -1))
          }}
          placeholder={valeurs.length ? '' : placeholder}
          role="combobox"
          aria-label={label}
          aria-expanded={ouvert}
          aria-controls={ouvert ? idListe : undefined}
          aria-activedescendant={ouvert && filtrees[actif] ? idOption(actif) : undefined}
          aria-autocomplete="list"
          // 16 px sur téléphone : en dessous, iOS zoome à chaque toucher
          className="min-w-[7rem] flex-1 border-0 bg-transparent p-0 text-[16px] text-surface-800 outline-none placeholder:text-surface-400 focus:ring-0 sm:text-sm"
        />
      </div>
      {ouvert && !disabled && (
        <ul id={idListe} role="listbox" aria-multiselectable="true"
          // La liste ne prend jamais le focus : clic sur une option, la barre de défilement ou un message
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-surface-200 bg-white py-1 shadow-modal">
          {filtrees.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-surface-400">{vide}</li>
          ) : filtrees.map((o, i) => (
            <li
              key={o.value}
              id={idOption(i)}
              role="option"
              aria-selected={choisies.has(o.value)}
              // La liste reste ouverte : on enchaîne plusieurs choix
              onClick={() => { basculer(o.value); setRecherche(''); champ.current?.focus() }}
              onMouseEnter={() => setActif(i)}
              className={cn('flex cursor-pointer items-center gap-2 px-3 py-2 text-sm', i === actif ? 'bg-brand-50' : 'hover:bg-surface-50')}
            >
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                choisies.has(o.value) ? 'border-brand-500 bg-brand-500 text-white' : 'border-surface-300 bg-white')}>
                {choisies.has(o.value) && <Check className="h-3 w-3" />}
              </span>
              <span className={cn('min-w-0 flex-1 break-words', i === actif ? 'text-brand-800' : 'text-surface-800')}>{o.label}</span>
              {o.detail && <span className="shrink-0 text-xs text-surface-400 tabular-nums">{o.detail}</span>}
            </li>
          ))}
          {options.length > 80 && filtrees.length === 80 && (
            <li className="border-t border-surface-100 px-3 py-1.5 text-2xs text-surface-400">Affinez la recherche pour voir plus de résultats</li>
          )}
        </ul>
      )}
    </div>
  )
}
