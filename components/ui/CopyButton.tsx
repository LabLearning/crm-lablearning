'use client'

import { useState } from 'react'
import { Copy, Check } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/** Formats de copie : ce que les formulaires (AKTO, France Travail…) attendent. */
export type FormatCopie = 'texte' | 'chiffres' | 'date' | 'telephone'

/** Met en forme une valeur pour la copie : SIRET et NIR sans espaces, dates JJ/MM/AAAA. */
export function valeurACopier(valeur: string | number | null | undefined, format: FormatCopie = 'texte'): string {
  const v = String(valeur ?? '').trim()
  if (!v) return ''
  if (format === 'chiffres') return v.replace(/\s+/g, '')
  if (format === 'telephone') return v.replace(/[\s.\-]/g, '')
  if (format === 'date') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v
  }
  return v
}

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    // Contexte non sécurisé ou permission refusée : repli sur la sélection
    try {
      const zone = document.createElement('textarea')
      zone.value = texte
      zone.setAttribute('readonly', '')
      zone.style.position = 'fixed'
      zone.style.opacity = '0'
      document.body.appendChild(zone)
      zone.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(zone)
      return ok
    } catch {
      return false
    }
  }
}

/**
 * Petit bouton « copier ». Utilisable dans un lien ou une ligne cliquable :
 * le clic ne se propage pas. L'icône passe en coche une seconde et demie.
 */
export function CopyButton({ valeur, format = 'texte', libelle, className }: {
  valeur: string | number | null | undefined
  format?: FormatCopie
  /** Ce qui est copié, pour les lecteurs d'écran : « Copier le SIRET ». */
  libelle?: string
  className?: string
}) {
  const [copie, setCopie] = useState(false)
  const texte = valeurACopier(valeur, format)
  if (!texte) return null

  return (
    <button
      type="button"
      title={copie ? 'Copié' : `Copier${libelle ? ` ${libelle}` : ''}`}
      aria-label={copie ? 'Copié' : `Copier${libelle ? ` ${libelle}` : ''}`}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (await copier(texte)) {
          setCopie(true)
          setTimeout(() => setCopie(false), 1500)
        }
      }}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md align-middle transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/40',
        copie ? 'text-success-600' : 'text-surface-300 hover:bg-surface-100 hover:text-brand-600',
        className,
      )}
    >
      {copie ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

/** Une valeur affichée suivie de son bouton de copie. */
export function Copiable({ valeur, format = 'texte', libelle, children, className }: {
  valeur: string | number | null | undefined
  format?: FormatCopie
  libelle?: string
  /** Affichage, si différent de la valeur copiée. */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-0.5', className)}>
      <span className="min-w-0 break-words">{children ?? valeur}</span>
      <CopyButton valeur={valeur} format={format} libelle={libelle} />
    </span>
  )
}
