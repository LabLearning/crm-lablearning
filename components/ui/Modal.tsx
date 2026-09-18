'use client'

import { useEffect, useCallback } from 'react'
import { X } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const modalSizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

/**
 * Modale du design system.
 * - Desktop (sm et plus) : boîte centrée, largeur selon `size`, 90 vh max.
 * - Téléphone (< 640 px) : feuille pleine largeur ancrée en bas, coins
 *   supérieurs arrondis, hauteur adaptée au contenu jusqu'à plein écran,
 *   poignée de fermeture, contenu défilant et zone sûre iOS respectée.
 */
export function Modal({ isOpen, onClose, title, description, children, size = 'md', className }: ModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => { document.removeEventListener('keydown', handleEscape); document.body.style.overflow = '' }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={cn(
        'relative w-full bg-white shadow-modal flex flex-col',
        // Feuille sur téléphone, boîte centrée au-delà
        'rounded-t-2xl max-h-[100dvh] animate-slide-up',
        'sm:rounded-2xl sm:max-h-[90vh] sm:animate-in-scale',
        modalSizes[size], className,
      )}>
        {/* Poignée (téléphone) */}
        <button type="button" onClick={onClose} aria-label="Fermer"
          className="sm:hidden mx-auto -mb-3 h-10 w-20 flex items-center justify-center shrink-0">
          <span className="h-1.5 w-10 rounded-full bg-surface-200" />
        </button>
        {(title || description) && (
          <div className="px-4 pt-2 sm:px-6 sm:pt-6 pb-0 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title && <h2 className="text-base font-heading font-semibold text-surface-900 tracking-tight">{title}</h2>}
                {description && <p className="text-sm text-surface-500 mt-0.5">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Fermer"
                className="h-10 w-10 sm:h-8 sm:w-8 -mt-2 -mr-2 sm:-mt-1 sm:-mr-1 shrink-0 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain safe-bottom">{children}</div>
      </div>
    </div>
  )
}
