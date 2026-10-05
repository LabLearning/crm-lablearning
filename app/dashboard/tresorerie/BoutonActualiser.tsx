'use client'

import { useFormStatus } from 'react-dom'
import { RefreshCw } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { rafraichirTresorerieAction } from './actions'

function Bouton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn-secondary !py-2 text-sm inline-flex items-center justify-center gap-1.5 min-h-10 w-full sm:w-auto">
      <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
      {pending ? 'Lecture de Qonto…' : 'Actualiser'}
    </button>
  )
}

export function BoutonActualiser() {
  return (
    <form action={rafraichirTresorerieAction} className="w-full sm:w-auto">
      <Bouton />
    </form>
  )
}
