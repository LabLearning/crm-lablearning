'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, Loader2, X, ArrowLeft } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

interface SearchPreview { title?: string; lines: { label: string; value: string }[] }
interface SearchResult { group: string; label: string; sublabel: string; href: string; preview?: SearchPreview }

/**
 * Recherche globale du header.
 * - Desktop (md et plus) : barre de recherche avec liste déroulante.
 * - Téléphone : `mobileTrigger` rend une loupe (40 px) qui ouvre une feuille
 *   plein écran (portail dans <body>, le header à backdrop-blur piégerait un
 *   élément `fixed`) avec le champ en haut et les résultats en liste.
 */
export function GlobalSearch({ mobileTrigger = false }: { mobileTrigger?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetInputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Raccourci "/" pour focus (desktop uniquement)
  useEffect(() => {
    if (mobileTrigger) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileTrigger])

  // Fermeture au clic extérieur (desktop)
  useEffect(() => {
    if (mobileTrigger) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [mobileTrigger])

  // Feuille mobile : focus du champ, verrou du défilement, fermeture Échap
  // et fermeture automatique si le viewport passe en desktop (rotation tablette) :
  // la feuille et son bouton sont md:hidden alors que le verrou du body resterait posé.
  useEffect(() => {
    if (!sheetOpen) return
    const t = setTimeout(() => sheetInputRef.current?.focus(), 50)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeSheet() }
    document.addEventListener('keydown', onKey)
    // Seuil = breakpoint `md` de Tailwind (768 px, écrans par défaut)
    const mq = window.matchMedia('(min-width: 768px)')
    function onMq(e: MediaQueryListEvent | MediaQueryList) { if (e.matches) closeSheet() }
    if (mq.matches) closeSheet()
    mq.addEventListener('change', onMq)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen])

  function handleChange(value: string) {
    setQuery(value)
    clearTimeout(timer.current)
    if (value.trim().length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal })
        const data = await res.json()
        setResults(data.results || [])
        setOpen(true)
      } catch { /* requête annulée ou erreur réseau */ }
      setLoading(false)
    }, 250)
  }

  function closeSheet() {
    setSheetOpen(false)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function go(href: string) {
    setOpen(false)
    setSheetOpen(false)
    setQuery('')
    setResults([])
    router.push(href)
  }

  // Groupement pour l'affichage
  const groups = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.group] ||= []).push(r)
    return acc
  }, {})

  const hoveredPreview = results[hoveredIdx]?.preview

  const liste = (dense: boolean) => (
    results.length === 0 ? (
      <div className="px-4 py-3 text-sm text-surface-400">Aucun résultat pour « {query} »</div>
    ) : (
      Object.entries(groups).map(([group, items]) => (
        <div key={group} className="mb-1">
          <div className="px-4 pt-2 pb-1 text-[11px] font-bold text-surface-900 uppercase tracking-wider">{group}</div>
          {items.map((r) => {
            const idx = results.indexOf(r)
            return (
              <button
                key={idx}
                onClick={() => go(r.href)}
                onMouseEnter={() => setHoveredIdx(idx)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-4 text-left hover:bg-surface-50 active:bg-surface-100 transition-colors',
                  dense ? 'py-2' : 'py-3 min-h-[44px] border-b border-surface-100 last:border-0',
                )}
              >
                <span className="text-sm text-surface-700 truncate">{r.label}</span>
                {r.sublabel && <span className="text-xs text-surface-500 shrink-0 truncate max-w-[140px]">{r.sublabel}</span>}
              </button>
            )
          })}
        </div>
      ))
    )
  )

  if (mobileTrigger) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Rechercher"
          className="md:hidden h-10 w-10 flex items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>

        {mounted && sheetOpen && createPortal(
          <div className="fixed inset-0 z-[60] bg-white flex flex-col md:hidden animate-fade-in">
            <div className="flex items-center gap-2 px-3 h-[60px] border-b border-surface-200/60 shrink-0">
              <button type="button" onClick={closeSheet} aria-label="Fermer la recherche"
                className="h-10 w-10 flex items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 flex items-center gap-2.5 bg-surface-50 rounded-xl px-3.5 h-11 border border-surface-200/60 focus-within:border-brand-400 focus-within:ring-[3px] focus-within:ring-accent-400/35 transition-colors">
                {loading ? <Loader2 className="h-4 w-4 text-surface-400 animate-spin shrink-0" /> : <Search className="h-4 w-4 text-surface-400 shrink-0" />}
                <input
                  ref={sheetInputRef}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  placeholder="Client, session, lead, formateur…"
                  className="bg-transparent text-base text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1 min-w-0 h-full"
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); setResults([]) }} aria-label="Effacer"
                    className="h-8 w-8 -mr-1.5 flex items-center justify-center rounded-lg text-surface-400 hover:bg-surface-200/60">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain py-1 safe-bottom">
              {query.trim().length < 2 ? (
                <p className="px-5 py-8 text-sm text-surface-400 text-center">Saisissez au moins deux caractères pour lancer la recherche.</p>
              ) : results.length === 0 && loading ? null : liste(false)}
            </div>
          </div>,
          document.body,
        )}
      </>
    )
  }

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <div className="flex items-center gap-2.5 bg-surface-50 rounded-xl px-3.5 py-2 w-72 border border-surface-200/60 hover:border-surface-300 focus-within:border-surface-300 transition-colors">
        {loading ? <Loader2 className="h-3.5 w-3.5 text-surface-400 animate-spin" /> : <Search className="h-3.5 w-3.5 text-surface-400" />}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Rechercher (client, session, lead…)"
          className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1"
        />
        <kbd className="hidden sm:inline-flex text-2xs text-surface-400 bg-white border border-surface-200 rounded-md px-1.5 py-0.5 font-mono leading-none">
          /
        </kbd>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-[420px] rounded-2xl bg-white border border-surface-200 shadow-modal overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto py-2">
            {liste(true)}
          </div>
          {/* Infos du résultat survolé, sous la liste, jamais sur le côté */}
          {hoveredPreview && hoveredPreview.lines.length > 0 && (
            <div className="border-t border-surface-100 bg-surface-50/60 px-4 py-3 text-left">
              {hoveredPreview.title && <div className="text-xs font-semibold text-surface-900 mb-1.5 leading-snug">{hoveredPreview.title}</div>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {hoveredPreview.lines.map((l, j) => (
                  <div key={j} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-surface-400">{l.label}</span>
                    <span className="text-xs text-surface-700 break-words">{l.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
