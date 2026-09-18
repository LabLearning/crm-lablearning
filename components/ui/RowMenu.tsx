'use client'

import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export interface RowMenuItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  target?: string
  danger?: boolean
  hidden?: boolean
  /** Ligne d'information non cliquable */
  info?: boolean
  infoColor?: string
}

interface RowMenuProps {
  items: RowMenuItem[]
  align?: 'right' | 'left'
  trigger?: React.ReactNode
  triggerClassName?: string
  width?: number
}

/**
 * Menu d'actions (3 points) rendu dans un portal en position fixe : il n'est
 * jamais rogné par un parent en overflow-hidden / overflow-x-auto (cartes, tables).
 */
export function RowMenu({ items, align = 'right', trigger, triggerClassName, width = 180 }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxH: number }>({ top: 0, left: 0, maxH: 400 })

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const left = align === 'right' ? r.right - width : r.left
    const maxLeft = window.innerWidth - width - 8
    const clampedLeft = Math.min(Math.max(8, left), Math.max(8, maxLeft))
    const spaceBelow = window.innerHeight - r.bottom - 8
    const spaceAbove = r.top - 8
    // On bascule vers le haut si peu de place en dessous ET plus de place au-dessus
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow
    setPos({
      left: clampedLeft,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxH: Math.max(160, (openUp ? spaceAbove : spaceBelow) - 4),
    })
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const visible = items.filter((i) => !i.hidden)

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={cn(
          'p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors',
          // Déclencheur par défaut : cible tactile 40 x 40 sous sm, 28 px inchangés au-delà.
          // Uniquement quand le module ne fournit ni contenu ni classes (il gère alors lui-même sa taille).
          !trigger && !triggerClassName && 'h-10 w-10 sm:h-auto sm:w-auto sm:p-1.5 inline-flex items-center justify-center',
          triggerClassName,
        )}
      >
        {trigger || <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width, maxHeight: pos.maxH }}
            className="fixed z-[61] bg-white rounded-xl border border-surface-200 shadow-elevated py-1 animate-in-scale origin-top-right overflow-y-auto"
          >
            {visible.map((it, i) => {
              if (it.info) {
                return <div key={i} className={cn('px-3 py-1.5 text-xs', it.infoColor || 'text-surface-400')}>{it.label}</div>
              }
              const cls = cn(
                'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors',
                it.danger ? 'text-danger-600 hover:bg-danger-50' : 'text-surface-700 hover:bg-surface-50',
              )
              if (it.href) {
                return (
                  <a key={i} href={it.href} target={it.target} rel={it.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className={cls} onClick={() => setOpen(false)}>
                    {it.icon}{it.label}
                  </a>
                )
              }
              return (
                <button key={i} className={cls} onClick={() => { setOpen(false); it.onClick?.() }}>
                  {it.icon}{it.label}
                </button>
              )
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
