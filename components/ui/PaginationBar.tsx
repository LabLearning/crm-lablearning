'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationBarProps {
  total: number
  page: number
  perPage: number
}

/** Barre de pagination pilotée par l'URL (?page=N), préserve les autres paramètres. */
export function PaginationBar({ total, page, perPage }: PaginationBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  if (totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete('page')
    else params.set('page', String(p))
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`)
  }

  // Fenêtre compacte : 1 … p-1 p p+1 … N
  const pages: (number | '…')[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-surface-100">
      <div className="text-xs text-surface-500">
        {from}–{to} sur {new Intl.NumberFormat('fr-FR').format(total)}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`e${idx}`} className="px-1.5 text-xs text-surface-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              className={cn(
                'min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors',
                p === page
                  ? 'bg-surface-900 text-white'
                  : 'text-surface-600 hover:bg-surface-100'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
