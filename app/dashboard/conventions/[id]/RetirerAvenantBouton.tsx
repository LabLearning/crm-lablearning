'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'
import { retirerAvenantCorrectionAction } from '../actions'

/** Retire un avenant de prix né d'une erreur de saisie : la convention n'en fait plus mention. */
export function RetirerAvenantBouton({ avenantId, numero }: { avenantId: string; numero: number }) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()

  const retirer = () => {
    if (!confirm(`Retirer l’avenant n°${numero} ?\n\nÀ faire seulement pour corriger une erreur de saisie que le client connaît : la convention affichera le prix actuel, sans mention d’avenant. La correction reste notée sur la convention et au journal d’activité.`)) return
    start(async () => {
      const r = await retirerAvenantCorrectionAction(avenantId)
      if (r.success) { toast('success', `Avenant n°${numero} retiré`); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <button type="button" onClick={retirer} disabled={pending}
      className="shrink-0 text-xs font-medium text-surface-500 underline decoration-surface-300 underline-offset-2 hover:text-danger-600 disabled:opacity-50">
      {pending ? 'Retrait…' : 'Erreur de saisie : retirer'}
    </button>
  )
}
