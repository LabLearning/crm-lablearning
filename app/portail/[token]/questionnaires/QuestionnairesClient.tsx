'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui'
import { RafraichissementAuto } from '@/components/ui/RafraichissementAuto'
import { QCM_TYPE_LABELS, QCM_TYPE_COLORS, QCM_TYPE_QUALIOPI } from '@/lib/types/evaluation'
import { formatDate } from '@/lib/utils'
import { ListChecks, Clock, CheckCircle2, ChevronRight } from '@/components/ui/icons'
import type { QCMType } from '@/lib/types/evaluation'
import QcmPlayer from './QcmPlayer'

interface QcmChoix {
  id: string
  texte: string
  est_correct: boolean
  position: number
}

interface QcmQuestion {
  id: string
  texte: string
  position: number
  points: number
  type: string
  explication: string | null
  choix: QcmChoix[]
}

interface PendingReponse {
  id: string
  qcm_id: string
  created_at: string
  qcm: {
    titre: string
    type: string
    description: string | null
    duree_minutes: number | null
    score_min_reussite: number | null
    questions: QcmQuestion[]
  } | null
}

interface CompletedReponse {
  id: string
  qcm_id: string
  score: number | null
  is_reussi: boolean | null
  completed_at: string | null
  duree_secondes: number | null
  qcm: {
    titre: string
    type: string
    score_min_reussite: number | null
  } | null
}

interface QuestionnairesClientProps {
  token: string
  pendingReponses: PendingReponse[]
  completedReponses: CompletedReponse[]
}

export default function QuestionnairesClient({
  token,
  pendingReponses,
  completedReponses,
}: QuestionnairesClientProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<{ reponseId: string; qcm: PendingReponse['qcm'] } | null>(null)

  if (selected && selected.qcm) {
    return (
      <div className="space-y-4 animate-fade-in">
        <QcmPlayer
          token={token}
          reponseId={selected.reponseId}
          qcm={selected.qcm}
          // Retour à la liste à jour : le questionnaire terminé passe dans « Complétés »
          onRetour={() => { setSelected(null); router.refresh() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En salle, le formateur ouvre les questionnaires au fil du cours : la liste se
          met à jour seule, sans que le stagiaire recharge (jamais pendant un questionnaire) */}
      <RafraichissementAuto secondes={15} />
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Mes questionnaires</h1>
        <p className="text-surface-500 mt-1">QCM et questionnaires de satisfaction</p>
      </div>

      {/* Pending */}
      {pendingReponses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-warning-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            A compléter ({pendingReponses.length})
          </h2>
          <div className="space-y-3">
            {pendingReponses.map((r) => (
              <div
                key={r.id}
                className="card p-5 border-warning-200 border hover:shadow-card transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={QCM_TYPE_COLORS[r.qcm?.type as QCMType]}>
                        {QCM_TYPE_LABELS[r.qcm?.type as QCMType]}
                      </Badge>
                      <span className="text-2xs text-surface-400">
                        {QCM_TYPE_QUALIOPI[r.qcm?.type as QCMType]}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-surface-900">
                      {r.qcm?.titre || 'Questionnaire'}
                    </h3>
                    {r.qcm?.description && (
                      <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{r.qcm.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                      {r.qcm?.duree_minutes && <span>{r.qcm.duree_minutes} min</span>}
                      {r.qcm?.questions && (
                        <span>{r.qcm.questions.length} question{r.qcm.questions.length !== 1 ? 's' : ''}</span>
                      )}
                      <span>Envoyé le {formatDate(r.created_at, { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                  {(r as any)._disponible_le ? (
                    <span className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-100 text-surface-500 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Disponible le {formatDate((r as any)._disponible_le, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : (
                    <button
                      onClick={() => r.qcm && setSelected({ reponseId: r.id, qcm: r.qcm })}
                      disabled={!r.qcm || !r.qcm.questions || r.qcm.questions.length === 0}
                      className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-xl bg-warning-100 text-warning-700 text-sm font-medium hover:bg-warning-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Commencer
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedReponses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-success-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Complétés ({completedReponses.length})
          </h2>
          <div className="space-y-3">
            {completedReponses.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={QCM_TYPE_COLORS[r.qcm?.type as QCMType]}>
                        {QCM_TYPE_LABELS[r.qcm?.type as QCMType]}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium text-surface-800">{r.qcm?.titre}</h3>
                    <div className="text-xs text-surface-500 mt-0.5">
                      {r.completed_at
                        ? `Complété le ${formatDate(r.completed_at, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : ''}
                      {r.duree_secondes ? ` · ${Math.floor(r.duree_secondes / 60)} min` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.score !== null && (
                      <div
                        className={`text-xl font-heading font-bold ${
                          r.is_reussi === true
                            ? 'text-success-600'
                            : r.is_reussi === false
                            ? 'text-danger-600'
                            : 'text-surface-700'
                        }`}
                      >
                        {r.score}%
                      </div>
                    )}
                    {r.is_reussi !== null && (
                      <div className={`text-xs ${r.is_reussi ? 'text-success-600' : 'text-danger-600'}`}>
                        {r.is_reussi ? 'Réussi' : 'Non réussi'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingReponses.length === 0 && completedReponses.length === 0 && (
        <div className="card p-12 text-center">
          <ListChecks className="h-8 w-8 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">Aucun questionnaire pour le moment</p>
        </div>
      )}
    </div>
  )
}
