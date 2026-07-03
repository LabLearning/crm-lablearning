import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

// Pastille "POEI" (Préparation Opérationnelle à l'Emploi) — repère visuel commun
export function PoeiBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 text-2xs font-semibold', className)}>
      <GraduationCap className="h-3 w-3 shrink-0" /> POEI
    </span>
  )
}
