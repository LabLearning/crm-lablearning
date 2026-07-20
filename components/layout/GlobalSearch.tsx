'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchPreview { title?: string; lines: { label: string; value: string }[] }
interface SearchResult { group: string; label: string; sublabel: string; href: string; preview?: SearchPreview }

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const abortRef = useRef<AbortController | null>(null)

  // Raccourci "/" pour focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Fermeture au clic extérieur
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

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

  function go(href: string) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(href)
  }

  // Groupement pour l'affichage
  const groups = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.group] ||= []).push(r)
    return acc
  }, {})

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
        <kbd className="hidden sm:inline-flex text-[10px] text-surface-400 bg-white border border-surface-200 rounded-md px-1.5 py-0.5 font-mono leading-none">
          /
        </kbd>
      </div>

      {open && (() => {
        const hoveredPreview = results[hoveredIdx]?.preview
        return (
          <div className="absolute z-50 mt-2 w-[420px] rounded-2xl bg-white border border-surface-200 shadow-modal overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto py-2">
              {results.length === 0 ? (
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
                          className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-50 transition-colors"
                        >
                          <span className="text-sm text-surface-700 truncate">{r.label}</span>
                          {r.sublabel && <span className="text-xs text-surface-500 shrink-0 truncate max-w-[140px]">{r.sublabel}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
            {/* Infos du résultat survolé — sous la liste, jamais sur le côté */}
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
        )
      })()}
    </div>
  )
}
