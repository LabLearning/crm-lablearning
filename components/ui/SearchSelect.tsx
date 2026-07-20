'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchSelectPreview {
  title?: string
  lines: { label: string; value: string }[]
}
interface Option { value: string; label: string; preview?: SearchSelectPreview }

interface SearchSelectProps {
  id?: string
  label?: string
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  clearable?: boolean
}

function PreviewCard({ preview }: { preview: SearchSelectPreview }) {
  const lines = preview.lines.filter((l) => l.value)
  if (lines.length === 0) return null
  // Affichée SOUS la liste (dans le même panneau) → jamais coupée ni sur le côté
  return (
    <div className="border-t border-surface-100 bg-surface-50/60 px-3 py-2.5 text-left">
      {preview.title && <div className="text-xs font-semibold text-surface-900 mb-1.5 leading-snug">{preview.title}</div>}
      <div className="space-y-1">
        {lines.map((l, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-surface-400">{l.label}</span>
            <span className="text-xs text-surface-700">{l.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Select avec recherche intégrée — pour les longues listes (clients, apprenants…). */
export function SearchSelect({
  id, label, options, value, onChange, placeholder = 'Rechercher…', error, clearable = true,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
    return list.slice(0, 100)
  }, [options, query])

  // Fermeture au clic extérieur
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function select(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      {label && <label htmlFor={id} className="block text-sm font-medium text-surface-700 mb-1.5">{label}</label>}

      {open ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
          <input
            ref={inputRef}
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); setQuery('') }
              if (e.key === 'Enter') { e.preventDefault(); if (filtered.length === 1) select(filtered[0].value) }
            }}
            placeholder={placeholder}
            className={cn('input-base w-full pl-9', error && 'border-danger-300')}
          />
        </div>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => setOpen(true)}
          className={cn(
            'input-base w-full flex items-center justify-between gap-2 text-left cursor-pointer',
            !selected && 'text-surface-400',
            error && 'border-danger-300',
          )}
        >
          <span className="truncate">{selected?.label || placeholder}</span>
          <span className="flex items-center gap-1 shrink-0">
            {clearable && selected && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange('') } }}
                className="p-0.5 rounded hover:bg-surface-100 text-surface-400 hover:text-surface-600"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-surface-400" />
          </span>
        </button>
      )}

      {open && (() => {
        const hoveredOpt = filtered.find((o) => o.value === hovered)
        return (
          <div className="absolute z-50 mt-1 w-full rounded-xl bg-white border border-surface-200 shadow-modal overflow-hidden">
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-surface-400">Aucun résultat</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => select(o.value)}
                    onMouseEnter={() => setHovered(o.value)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-50 transition-colors',
                      o.value === value ? 'text-surface-900 font-medium' : 'text-surface-700',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value && <Check className="h-4 w-4 text-brand-500 shrink-0" />}
                  </button>
                ))
              )}
              {options.length > 100 && filtered.length === 100 && (
                <div className="px-3 py-1.5 text-2xs text-surface-400 border-t border-surface-100">
                  Affinez la recherche pour voir plus de résultats
                </div>
              )}
            </div>
            {/* Carte d'infos de l'option survolée — sous la liste, jamais sur le côté */}
            {hoveredOpt?.preview && <PreviewCard preview={hoveredOpt.preview} />}
          </div>
        )
      })()}

      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  )
}
