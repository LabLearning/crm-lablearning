'use client'

import { useState, useTransition } from 'react'
import { FileText, ChevronDown, ChevronUp, Save, Send, CheckCircle2, Clock, Loader2, Calendar } from '@/components/ui/icons'
import { saveRapportAction } from './actions'
import { Badge } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'

interface Session {
  id: string; reference: string; status: string; date_debut: string; date_fin: string; lieu: string | null
  formation: { intitule: string } | null
}
interface Rapport {
  id: string; session_id: string; status: string; contenu_aborde: string | null; objectifs_atteints: string | null
  objectifs_non_atteints: string | null; difficultes_rencontrees: string | null; recommandations: string | null
  points_positifs: string | null; commentaires_generaux: string | null; commentaires_apprenants: any[]
}
interface Inscription {
  session_id: string; apprenant: { id: string; prenom: string; nom: string } | null
}

interface RapportsListProps {
  sessions: Session[]; rapports: Rapport[]; inscriptions: Inscription[]
}

const RAPPORT_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  brouillon: { label: 'Brouillon', variant: 'default' },
  soumis: { label: 'Soumis', variant: 'warning' },
  valide: { label: 'Validé', variant: 'success' },
}

export function RapportsList({ sessions, rapports, inscriptions }: RapportsListProps) {
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function getRapport(sessionId: string) {
    return rapports.find(r => r.session_id === sessionId)
  }

  function getApprenants(sessionId: string) {
    return inscriptions.filter(i => i.session_id === sessionId).map(i => i.apprenant).filter(Boolean)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)
    formData.set('submit', submit ? 'true' : 'false')

    startTransition(async () => {
      const result = await saveRapportAction(formData)
      if (result.success) {
        setSuccess(submit ? 'Rapport soumis' : 'Brouillon enregistré')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || 'Erreur')
      }
    })
  }

  return (
    <div className="space-y-3">
      {sessions.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-400">
          <FileText className="h-8 w-8 mx-auto mb-2 text-surface-300" />
          Aucune session terminée ou en cours
        </div>
      )}

      {success && <div className="text-sm text-success-600 bg-success-50 border border-success-200 rounded-xl px-4 py-3">{success}</div>}
      {error && <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">{error}</div>}

      {sessions.map(session => {
        const rapport = getRapport(session.id)
        const apprenants = getApprenants(session.id)
        const isOpen = openSession === session.id
        const st = RAPPORT_STATUS[rapport?.status || 'brouillon'] || RAPPORT_STATUS.brouillon
        const needsRapport = !rapport && session.status === 'terminee'

        return (
          <div key={session.id} className="card overflow-hidden">
            {/* En-tête */}
            <button
              onClick={() => setOpenSession(isOpen ? null : session.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                  needsRapport ? 'bg-amber-100' : rapport ? 'bg-emerald-100' : 'bg-surface-100'
                )}>
                  {rapport ? <CheckCircle2 className={cn('h-4 w-4', rapport.status === 'valide' ? 'text-emerald-600' : 'text-amber-600')} /> : <FileText className="h-4 w-4 text-surface-500" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{session.formation?.intitule || session.reference}</div>
                  <div className="text-xs text-surface-500">
                    {formatDate(session.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(session.date_fin, { day: 'numeric', month: 'short' })}
                    {session.lieu && ` · ${session.lieu}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rapport && <Badge variant={st.variant}>{st.label}</Badge>}
                {needsRapport && <Badge variant="warning">À rédiger</Badge>}
                {isOpen ? <ChevronUp className="h-4 w-4 text-surface-400" /> : <ChevronDown className="h-4 w-4 text-surface-400" />}
              </div>
            </button>

            {/* Formulaire rapport */}
            {isOpen && (
              <form onSubmit={(e) => handleSubmit(e, false)} className="border-t border-surface-100 p-4 space-y-4">
                <input type="hidden" name="session_id" value={session.id} />

                {[
                  { name: 'contenu_aborde', label: 'Contenu abordé', placeholder: 'Décrivez les thèmes et modules couverts durant la formation...' },
                  { name: 'objectifs_atteints', label: 'Objectifs atteints', placeholder: 'Quels objectifs pédagogiques ont été atteints ?' },
                  { name: 'objectifs_non_atteints', label: 'Objectifs non atteints', placeholder: 'Y a-t-il des objectifs qui n\'ont pas pu être couverts ?' },
                  { name: 'points_positifs', label: 'Points positifs', placeholder: 'Points forts de la session, engagement des apprenants...' },
                  { name: 'difficultes_rencontrees', label: 'Difficultés rencontrées', placeholder: 'Problèmes logistiques, pédagogiques, techniques...' },
                  { name: 'recommandations', label: 'Recommandations', placeholder: 'Suggestions pour les prochaines sessions...' },
                  { name: 'commentaires_generaux', label: 'Commentaires généraux', placeholder: 'Toute information complémentaire...' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="text-sm font-medium text-surface-700 mb-1.5 block">{field.label}</label>
                    <textarea
                      name={field.name}
                      rows={3}
                      defaultValue={(rapport as any)?.[field.name] || ''}
                      placeholder={field.placeholder}
                      className="input-base resize-none text-sm"
                    />
                  </div>
                ))}

                {/* Commentaires par apprenant */}
                {apprenants.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-surface-700 mb-2 block">Commentaires par apprenant</label>
                    <div className="space-y-2">
                      {apprenants.map((a: any) => {
                        const existing = (Array.isArray(rapport?.commentaires_apprenants) ? rapport.commentaires_apprenants : (rapport as any)?.commentaires_apprenants?.stagiaires || []).find((c: any) => c.apprenant_id === a.id)
                        return (
                          <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50">
                            <div className="text-sm font-medium text-surface-800 w-32 shrink-0 pt-2">{a.prenom} {a.nom}</div>
                            <textarea
                              data-apprenant-id={a.id}
                              data-apprenant-nom={`${a.prenom} ${a.nom}`}
                              rows={2}
                              defaultValue={existing?.commentaire || ''}
                              placeholder="Niveau, progression, remarques..."
                              className="input-base resize-none text-sm flex-1"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={(e) => {
                      const form = (e.target as HTMLElement).closest('form')!
                      const formData = new FormData(form)
                      formData.set('submit', 'true')
                      startTransition(async () => {
                        const result = await saveRapportAction(formData)
                        if (result.success) { setSuccess('Rapport soumis'); setTimeout(() => setSuccess(null), 3000) }
                        else setError(result.error || 'Erreur')
                      })
                    }}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Soumettre le rapport
                  </button>
                </div>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
