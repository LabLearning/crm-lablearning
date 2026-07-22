import { ClipboardCheck, QrCode, CheckCircle2, Clock } from 'lucide-react'

interface QcmSession {
  id: string
  qcm_id: string
  qcm: { id: string; titre: string; type: string; score_min_reussite: number | null } | null
}
interface QcmReponse {
  qcm_id: string
  apprenant_id: string
  score: number | null
  is_reussi: boolean | null
  is_complete: boolean | null
}

/**
 * Questionnaires de la session côté formateur : il projette le QR code en salle
 * et suit qui a répondu. Le rattachement d'un QCM reste une action admin.
 */
export function QcmFormateur({
  token,
  sessionId,
  qcmSessions,
  qcmReponses,
  nbStagiaires,
}: {
  token: string
  sessionId: string
  qcmSessions: QcmSession[]
  qcmReponses: QcmReponse[]
  nbStagiaires: number
}) {
  if (qcmSessions.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Questionnaires ({qcmSessions.length})
          </span>
        </div>
        <a
          href={`/api/sessions/${sessionId}/qr-codes?token=${token}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-900 text-white text-xs font-medium hover:bg-surface-800 transition-colors"
        >
          <QrCode className="h-3.5 w-3.5" /> Projeter les QR codes
        </a>
      </div>

      <div className="divide-y divide-surface-100">
        {qcmSessions.map((qs) => {
          const rep = qcmReponses.filter((r) => r.qcm_id === qs.qcm_id)
          const repondu = rep.filter((r) => r.is_complete).length
          const seuil = qs.qcm?.score_min_reussite ?? null
          return (
            <div key={qs.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">
                    {qs.qcm?.titre || 'Questionnaire'}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">
                    {repondu}/{nbStagiaires} répondu{repondu > 1 ? 's' : ''}
                    {seuil != null && <span> · réussite ≥ {seuil}%</span>}
                  </div>
                </div>
                <span className={
                  repondu >= nbStagiaires && nbStagiaires > 0
                    ? 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600'
                    : 'inline-flex items-center gap-1 text-[11px] font-semibold text-surface-400'
                }>
                  {repondu >= nbStagiaires && nbStagiaires > 0
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Complet</>
                    : <><Clock className="h-3.5 w-3.5" /> En cours</>}
                </span>
              </div>

              {/* Détail par stagiaire ayant répondu */}
              {repondu > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rep.filter((r) => r.is_complete).map((r, i) => (
                    <span
                      key={i}
                      className={
                        r.is_reussi
                          ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium'
                          : 'text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium'
                      }
                    >
                      {r.score != null ? `${Math.round(r.score)}%` : '—'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2 bg-surface-50/60 text-[11px] text-surface-500">
        Affichez les QR codes au tableau : chaque apprenant scanne le sien et répond sur son téléphone.
      </div>
    </div>
  )
}
