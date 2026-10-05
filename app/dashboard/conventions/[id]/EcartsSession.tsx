'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, RefreshCw } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { reprendreFormationSessionAction, reprendrePrixSessionAction } from '../actions'

interface Props {
  conventionId: string
  numero: string
  /** Le client a déjà signé : rien ne change sans ce geste. */
  signee: boolean
  sessionReference: string | null
  /** Écart de programme, déjà mis en forme : « Intitulé » (7 h). */
  programme: { convention: string; session: string } | null
  /** Écart de prix, déjà mis en forme : 2 100,00 €. */
  prix: { convention: string; session: string } | null
  peutReprendre: boolean
}

/**
 * La convention ne dit plus la même chose que sa session : programme (donc
 * intitulé, durée et annexe) ou prix. Chaque écart se reprend d'un geste.
 */
export function EcartsSession({ conventionId, numero, signee, sessionReference, programme, prix, peutReprendre }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!programme && !prix) return null

  const reprendre = (quoi: 'programme' | 'prix') => {
    const e = quoi === 'programme' ? programme! : prix!
    if (signee && !confirm(`Remplacer le ${quoi} de la convention signée ${numero} ?\n\n${e.convention}\ndevient\n${e.session}\n\nLa signature du client est conservée. Le changement est noté en interne, sans avenant ni mention sur le document.`)) return
    start(async () => {
      const r = quoi === 'programme' ? await reprendreFormationSessionAction(conventionId) : await reprendrePrixSessionAction(conventionId)
      if (r.success) { toast('success', quoi === 'programme' ? 'Programme repris : intitulé, durée et annexe sont à jour' : 'Prix repris de la session'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  const ligne = (quoi: 'programme' | 'prix', titre: string, e: { convention: string; session: string }) => (
    <div className="mt-3 border-t border-warning-500/20 pt-3 first:mt-2 first:border-t-0 first:pt-0">
      <div className="section-label">{titre}</div>
      <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-surface-500">Session{sessionReference ? ` ${sessionReference}` : ''}</dt>
        <dd className="font-medium text-surface-900">{e.session}</dd>
        <dt className="text-surface-500">Cette convention</dt>
        <dd className="text-surface-700">{e.convention}</dd>
      </dl>
      {peutReprendre && (
        <button type="button" onClick={() => reprendre(quoi)} disabled={pending} className="btn-primary mt-2 inline-flex min-h-10 items-center gap-1.5 !py-2 text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Reprendre le {quoi} de la session
        </button>
      )}
    </div>
  )

  return (
    <section className="card border-warning-500/30 bg-warning-50 p-4 sm:p-5" aria-labelledby="ecarts-session-titre">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
        <div className="min-w-0 flex-1">
          <h2 id="ecarts-session-titre" className="font-heading font-semibold text-surface-900">
            La convention ne suit plus sa session
          </h2>
          <div>
            {programme && ligne('programme', 'Programme (intitulé, durée, annexe)', programme)}
            {prix && ligne('prix', 'Prix HT', prix)}
          </div>
          <p className="mt-3 text-xs text-surface-600">
            {signee
              ? 'La convention est signée : elle garde ses valeurs tant que vous ne les reprenez pas. La reprise conserve la signature du client et ne laisse ni avenant ni mention ; l’ancienne valeur est notée en interne. Si le client doit valider le changement, annulez plutôt la signature depuis la liste des conventions, puis renvoyez-la.'
              : 'La convention n’est pas encore signée : le client signera le document à jour.'}
            {prix ? ' Si c’est le prix de la convention qui est le bon, corrigez-le sur la session.' : ''}
          </p>
        </div>
      </div>
    </section>
  )
}
