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
interface Stagiaire { id: string; prenom: string; nom: string }

/**
 * Questionnaires de la session côté formateur : il projette le QR code en salle,
 * suit qui a répondu et voit le résultat de chaque apprenant (comme l'admin).
 * Le rattachement d'un QCM reste une action admin.
 */
export function QcmFormateur({
  token,
  sessionId,
  qcmSessions,
  qcmReponses,
  stagiaires,
}: {
  token: string
  sessionId: string
  qcmSessions: QcmSession[]
  qcmReponses: QcmReponse[]
  stagiaires: Stagiaire[]
}) {
  if (qcmSessions.length === 0) return null
  const nbStagiaires = stagiaires.length

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
          const byApprenant = new Map(rep.map((r) => [r.apprenant_id, r]))
          const repondu = rep.filter((r) => r.is_complete).length
          const seuil = qs.qcm?.score_min_reussite ?? null

          return (
            <div key={qs.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 mb-2">
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
                    ? 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0'
                    : 'inline-flex items-center gap-1 text-[11px] font-semibold text-surface-400 shrink-0'
                }>
                  {repondu >= nbStagiaires && nbStagiaires > 0
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Complet</>
                    : <><Clock className="h-3.5 w-3.5" /> En cours</>}
                </span>
              </div>

              {/* Résultat détaillé par apprenant, comme la vue admin */}
              <div className="rounded-xl border border-surface-200 divide-y divide-surface-100">
                {stagiaires.map((s) => {
                  const r = byApprenant.get(s.id)
                  const fait = r?.is_complete
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                      {fait
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        : <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                      <span className="flex-1 min-w-0 text-sm text-surface-800 truncate">
                        {s.prenom} {s.nom}
                      </span>
                      {fait ? (
                        <span className="flex items-center gap-2 shrink-0">
                          {r?.score != null && (
                            <span className={
                              r.is_reussi === false
                                ? 'text-sm font-bold text-danger-600'
                                : 'text-sm font-bold text-emerald-600'
                            }>
                              {Math.round(r.score)}%
                            </span>
                          )}
                          {r?.is_reussi != null && (
                            <span className={
                              r.is_reussi
                                ? 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium'
                                : 'text-[10px] px-2 py-0.5 rounded-full bg-danger-50 text-danger-700 font-medium'
                            }>
                              {r.is_reussi ? 'Réussi' : 'Non réussi'}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 shrink-0">Non passé</span>
                      )}
                    </div>
                  )
                })}
              </div>
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
