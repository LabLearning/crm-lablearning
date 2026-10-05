'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, RefreshCw } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { reprendreFormationSessionAction } from '../actions'

interface Props {
  conventionId: string
  numero: string
  /** Le client a déjà signé : le programme ne change que par ce geste. */
  signee: boolean
  sessionReference: string | null
  /** Programme que porte la convention, déjà mis en forme : « Intitulé » (7 h). */
  avant: string
  /** Programme de la session. */
  apres: string
  peutReprendre: boolean
}

/** La session est passée sur un autre programme : la convention peut le reprendre (intitulé, durée, annexe). */
export function ReprendreProgramme({ conventionId, numero, signee, sessionReference, avant, apres, peutReprendre }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()

  const reprendre = () => {
    if (signee && !confirm(`Remplacer le programme de la convention signée ${numero} ?\n\n${avant}\ndevient\n${apres}\n\nLa signature du client est conservée. Le changement est noté en interne, sans avenant ni mention sur le document.`)) return
    start(async () => {
      const r = await reprendreFormationSessionAction(conventionId)
      if (r.success) { toast('success', 'Programme repris : intitulé, durée et annexe sont à jour'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <section className="card border-warning-500/30 bg-warning-50 p-4 sm:p-5" aria-labelledby="programme-ecart-titre">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
        <div className="min-w-0 flex-1">
          <h2 id="programme-ecart-titre" className="font-heading font-semibold text-surface-900">
            La session a changé de programme
          </h2>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-surface-500">Session{sessionReference ? ` ${sessionReference}` : ''}</dt>
            <dd className="font-medium text-surface-900">{apres}</dd>
            <dt className="text-surface-500">Cette convention</dt>
            <dd className="text-surface-700">{avant}</dd>
          </dl>
          <p className="mt-2 text-xs text-surface-600">
            {signee
              ? 'La convention est signée : son intitulé, sa durée et son annexe restent ceux de l’ancien programme tant que vous ne le reprenez pas. La reprise garde la signature du client et ne laisse ni avenant ni mention ; l’ancien programme est noté en interne. Si le client doit valider le nouveau programme, annulez plutôt la signature depuis la liste des conventions, puis renvoyez-la.'
              : 'L’intitulé, la durée et l’annexe de la convention sont encore ceux de l’ancien programme.'}
          </p>
          {peutReprendre && (
            <button type="button" onClick={reprendre} disabled={pending} className="btn-primary mt-3 inline-flex min-h-10 items-center gap-1.5 !py-2 text-sm">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reprendre le programme de la session
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
