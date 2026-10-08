'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'
import { retirerAvenantCorrectionAction } from '../actions'

/**
 * Retire un avenant né d'une erreur (prix mal saisi, ou liste des participants
 * qui ne correspondait pas aux stagiaires formés) : la convention n'en fait
 * plus mention. Geste du gestionnaire, tracé.
 */
export function RetirerAvenantBouton({ avenantId, numero, nature = 'prix' }: { avenantId: string; numero: number; nature?: 'prix' | 'participants' }) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()

  const retirer = () => {
    const message = nature === 'participants'
      ? `Retirer l’avenant n°${numero} ?\n\nÀ faire seulement pour corriger une erreur que le client connaît : la liste signée ne correspondait pas aux stagiaires réellement formés. La convention affichera la liste actuelle, sans mention d’avenant.\n\nLa correction reste tracée : notes internes, journal d’activité et certificat de signature. L’exemplaire signé archivé garde la liste d’origine.`
      : `Retirer l’avenant n°${numero} ?\n\nÀ faire seulement pour corriger une erreur de saisie que le client connaît : la convention affichera le prix actuel, sans mention d’avenant.\n\nLa correction reste tracée : notes internes, journal d’activité et certificat de signature.`
    if (!confirm(message)) return
    start(async () => {
      const r = await retirerAvenantCorrectionAction(avenantId)
      if (r.success) { toast('success', `Avenant n°${numero} retiré`); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <button type="button" onClick={retirer} disabled={pending}
      className="shrink-0 text-xs font-medium text-surface-500 underline decoration-surface-300 underline-offset-2 hover:text-danger-600 disabled:opacity-50">
      {pending ? 'Retrait…' : nature === 'participants' ? 'Erreur de liste : retirer' : 'Erreur de saisie : retirer'}
    </button>
  )
}
