import { ClipboardCheck, QrCode, CheckCircle2, Clock, Lock, Printer } from '@/components/ui/icons'
import { SendQcmButton } from '@/app/mon-espace/_formateur/SendQcmButton'
import { OuvrirQcmButton } from '@/app/mon-espace/_formateur/OuvrirQcmButton'
import { estOuvert } from '@/lib/qcm-ouverture'

interface QcmSession {
  id: string
  qcm_id: string
  date_ouverture?: string | null
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

const heure = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Questionnaires de la session côté formateur : il projette les QR codes
 * d'accès à la plateforme en salle (même sans questionnaire), ouvre chaque
 * questionnaire quand le cours en est là (fermé jusque-là pour les stagiaires,
 * lib/qcm-ouverture), suit qui a répondu et voit le résultat de chaque
 * apprenant (comme l'admin). Le rattachement d'un QCM reste une action admin.
 */
export function QcmFormateur({
  token,
  basePath,
  sessionId,
  qcmSessions,
  qcmReponses,
  stagiaires,
}: {
  token: string
  basePath: string
  sessionId: string
  qcmSessions: QcmSession[]
  qcmReponses: QcmReponse[]
  stagiaires: Stagiaire[]
}) {
  const nbStagiaires = stagiaires.length

  // Espace connecté : l'API QR s'authentifie via le cookie de session, donc pas
  // de token dans l'URL. Accès par lien de portail : on passe le token.
  const qrBase = `/api/sessions/${sessionId}/qr-codes`
  const qrHref = (projection: boolean) => {
    const params = new URLSearchParams()
    if (basePath !== '/mon-espace') params.set('token', token)
    if (projection) params.set('vue', 'projection')
    const qs = params.toString()
    return qs ? `${qrBase}?${qs}` : qrBase
  }

  return (
    <div className="space-y-4">
      {/* Accès des stagiaires à la plateforme : chacun scanne son QR code et arrive dans son espace */}
      {nbStagiaires > 0 && (
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <QrCode className="h-5 w-5 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-surface-900">Accès des stagiaires à la plateforme</div>
            <div className="text-xs text-surface-500 mt-0.5">
              Projetez les QR codes : chaque stagiaire scanne le sien avec son téléphone et retrouve ses questionnaires et ses supports.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={qrHref(true)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-900 text-white text-xs font-semibold hover:bg-surface-800 transition-colors">
              <QrCode className="h-3.5 w-3.5" /> Projeter les QR codes
            </a>
            <a href={qrHref(false)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 text-surface-700 text-xs font-semibold hover:bg-surface-50 transition-colors">
              <Printer className="h-3.5 w-3.5" /> Imprimer
            </a>
          </div>
        </div>
      )}

      {qcmSessions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Questionnaires ({qcmSessions.length})
            </span>
          </div>

          <div className="divide-y divide-surface-100">
            {qcmSessions.map((qs) => {
              const ouvert = estOuvert(qs.date_ouverture)
              const rep = qcmReponses.filter((r) => r.qcm_id === qs.qcm_id)
              const byApprenant = new Map(rep.map((r) => [r.apprenant_id, r]))
              const repondu = rep.filter((r) => r.is_complete).length
              const seuil = qs.qcm?.score_min_reussite ?? null
              const titre = qs.qcm?.titre || 'Questionnaire'

              return (
                <div key={qs.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-surface-900">{titre}</div>
                      <div className="text-xs text-surface-500 mt-0.5">
                        {ouvert
                          ? <>Ouvert le {heure(qs.date_ouverture!)} · {repondu}/{nbStagiaires} répondu{repondu > 1 ? 's' : ''}{seuil != null && <span> · réussite ≥ {seuil}%</span>}</>
                          : <>Fermé : les stagiaires ne le voient pas encore</>}
                      </div>
                    </div>
                    {ouvert ? (
                      <span className={
                        repondu >= nbStagiaires && nbStagiaires > 0
                          ? 'inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0'
                          : 'inline-flex items-center gap-1 text-[11px] font-semibold text-surface-400 shrink-0'
                      }>
                        {repondu >= nbStagiaires && nbStagiaires > 0
                          ? <><CheckCircle2 className="h-3.5 w-3.5" /> Complet</>
                          : <><Clock className="h-3.5 w-3.5" /> En cours</>}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-surface-400"><Lock className="h-3.5 w-3.5" /> Fermé</span>
                        <OuvrirQcmButton token={token} sessionId={sessionId} qcmSessionId={qs.id} titre={titre} />
                      </div>
                    )}
                  </div>

                  {ouvert && (
                    <>
                      {/* Envoi du questionnaire aux apprenants (email + WhatsApp) ; le
                          questionnaire à froid part tout seul trois mois après */}
                      <div className="flex justify-end my-2">
                        {qs.qcm?.type === 'satisfaction_froid'
                          ? <span className="text-[11px] text-surface-500">Envoyé automatiquement aux stagiaires trois mois après la formation</span>
                          : <SendQcmButton token={token} sessionId={sessionId} qcmId={qs.qcm_id} titre={titre} />}
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
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="px-4 py-2 bg-surface-50/60 text-[11px] text-surface-500">
            Ouvrez chaque questionnaire quand le cours en est là : il apparaît aussitôt sur le téléphone des stagiaires.
          </div>
        </div>
      )}
    </div>
  )
}
