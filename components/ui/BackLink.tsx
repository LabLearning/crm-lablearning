'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * Retour à la page PRÉCÉDENTE (et non vers une liste figée) : depuis une fiche
 * ouverte à partir d'une recherche, d'un tableau de bord ou d'une autre fiche,
 * l'utilisateur revient là d'où il vient. `fallbackHref` sert quand il n'y a
 * pas d'historique (lien ouvert directement, nouvel onglet).
 */
export function BackLink({
  fallbackHref,
  label,
  className,
  iconOnly = false,
}: {
  fallbackHref: string
  label?: string
  className?: string
  iconOnly?: boolean
}) {
  const router = useRouter()

  function goBack() {
    // history.length <= 1 → onglet ouvert directement sur cette page
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  if (iconOnly) {
    // Cible tactile 40 px sous sm (36 px au-delà, inchangé)
    return (
      <button type="button" onClick={goBack} title="Retour" aria-label="Retour"
        className={cn('min-h-10 min-w-10 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center', className || 'mt-1 p-2 rounded-xl hover:bg-surface-100 transition-colors shrink-0')}>
        <ArrowLeft className="h-5 w-5 text-surface-500" />
      </button>
    )
  }

  return (
    <button type="button" onClick={goBack}
      className={className || 'inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-3'}>
      <ArrowLeft className="h-4 w-4" /> {label || 'Retour'}
    </button>
  )
}
