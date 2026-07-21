import { GraduationCap, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Pastille "POEI" (Préparation Opérationnelle à l'Emploi).
 *
 * Un projet POEI produit deux natures de sessions qu'il faut pouvoir
 * distinguer d'un coup d'œil :
 *   - `parcours`     : chapeau administratif (convention, financement),
 *                      sans formateur par nature ;
 *   - `intervention` : période réellement animée par un formateur.
 */
export function PoeiBadge({
  className,
  role,
}: {
  className?: string
  role?: 'parcours' | 'intervention' | null
}) {
  if (role === 'parcours') {
    return (
      <span
        title="Parcours POEI — vue d'ensemble administrative. Les formateurs sont affectés par intervention."
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-surface-100 text-surface-600 border border-surface-200 px-2 py-0.5 text-2xs font-semibold',
          className,
        )}
      >
        <Layers className="h-3 w-3 shrink-0" /> Parcours POEI
      </span>
    )
  }

  return (
    <span
      title={role === 'intervention' ? 'Intervention POEI — période animée par un formateur' : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 text-2xs font-semibold',
        className,
      )}
    >
      <GraduationCap className="h-3 w-3 shrink-0" /> POEI
    </span>
  )
}
