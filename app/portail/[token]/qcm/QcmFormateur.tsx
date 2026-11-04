import { ClipboardCheck, QrCode, CheckCircle2, Clock, Lock, Printer, BookOpen, ChevronDown, XCircle, Quote } from '@/components/ui/icons'
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
  id?: string
  qcm_id: string
  apprenant_id: string
  score: number | null
  is_reussi: boolean | null
  is_complete: boolean | null
}
interface Stagiaire { id: string; prenom: string; nom: string }
interface Choix { id: string; texte: string; est_correct: boolean | null; position: number | null }
interface QuestionCorrige {
  id: string; qcm_id: string; texte: string; type: string; explication: string | null; position: number | null
  choix: Choix[] | null
}
interface DetailQuestion {
  reponse_id: string; question_id: string; choix_ids: string[] | null; texte_libre: string | null
  est_correct: boolean | null; note_valeur: number | null
}

const LETTRES = 'ABCDEFGH'
const choixTries = (q: QuestionCorrige) => [...(q.choix || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
const notable = (q: QuestionCorrige) => (q.choix || []).some((c) => c.est_correct === true)

/**
 * Questions, bonnes réponses et explications d'un questionnaire, avec pour chaque
 * choix le nombre de stagiaires qui l'ont coché : le formateur corrige en salle,
 * question par question. Replié par défaut : il contient le corrigé.
 */
function Corrige({ questions, completes, detailsParReponse, satisfaction }: {
  questions: QuestionCorrige[]
  completes: QcmReponse[]
  detailsParReponse: Map<string, Map<string, DetailQuestion>>
  satisfaction: boolean
}) {
  const total = completes.length
  return (
    <details className="group/corrige mt-3 rounded-xl border border-surface-200">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-surface-700 [&::-webkit-details-marker]:hidden">
        <BookOpen className="h-3.5 w-3.5 text-brand-600" />
        {satisfaction ? 'Questions et résultats' : 'Questions et corrigé'} ({questions.length})
        {!satisfaction && <span className="ml-auto text-[10px] font-normal text-surface-400">à ne pas projeter</span>}
        <ChevronDown className={`h-3.5 w-3.5 text-surface-400 transition-transform group-open/corrige:rotate-180 ${satisfaction ? 'ml-auto' : ''}`} />
      </summary>
      {total > 0 && (
        <div className="border-t border-surface-100 px-3 py-2 text-[11px] text-surface-500">
          {total} stagiaire{total > 1 ? 's ont' : ' a'} répondu · à droite de chaque choix, le nombre de stagiaires qui l’ont coché
        </div>
      )}
      <ol className="divide-y divide-surface-100 border-t border-surface-100">
        {questions.map((q, i) => {
          const choix = choixTries(q)
          const compte = new Map<string, number>()
          const textes: string[] = []
          let bonnes = 0
          for (const r of completes) {
            const d = r.id ? detailsParReponse.get(r.id)?.get(q.id) : undefined
            if (!d) continue
            for (const id of d.choix_ids || []) compte.set(id, (compte.get(id) || 0) + 1)
            if (d.texte_libre && d.texte_libre.trim()) textes.push(d.texte_libre.trim())
            if (d.est_correct === true) bonnes++
          }
          const avecCorrige = notable(q)
          const part = total > 0 ? Math.round((bonnes / total) * 100) : 0
          return (
            <li key={q.id} className="px-3 py-3">
              {/* La question et son score sur une ligne, les choix dessous sur toute la largeur */}
              <div className="flex items-start gap-2">
                <span className="w-6 shrink-0 pt-0.5 text-xs font-bold tabular-nums text-surface-400">{i + 1}.</span>
                <div className="min-w-0 flex-1 text-sm font-medium leading-snug text-surface-900">{q.texte}</div>
                {avecCorrige && total > 0 && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${part >= 75 ? 'bg-emerald-50 text-emerald-700' : part >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-danger-50 text-danger-700'}`}>
                    {bonnes}/{total}
                  </span>
                )}
              </div>
              <div className="pl-8">
                  {choix.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {choix.map((c, j) => {
                        const bonne = c.est_correct === true
                        return (
                          <li key={c.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${bonne ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' : 'text-surface-600'}`}>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${bonne ? 'bg-emerald-600 text-white' : 'bg-surface-100 text-surface-500'}`}>{LETTRES[j] || j + 1}</span>
                            <span className="min-w-0 flex-1">{c.texte}</span>
                            {bonne && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 sm:hidden" />}
                            {bonne && <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 sm:inline">Bonne réponse</span>}
                            {total > 0 && <span className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums text-surface-500">{compte.get(c.id) || 0}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {q.type === 'texte_libre' && (
                    textes.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {textes.map((t, k) => (
                          <li key={k} className="flex gap-1.5 text-xs italic text-surface-600"><Quote className="mt-0.5 h-3 w-3 shrink-0 text-surface-300" />{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-1 text-xs text-surface-400">Réponse libre{total > 0 ? ' · aucune réponse écrite' : ''}</div>
                    )
                  )}
                  {q.explication && (
                    <div className="mt-2 text-xs leading-relaxed text-surface-500"><span className="font-semibold text-surface-600">Pourquoi : </span>{q.explication}</div>
                  )}
              </div>
            </li>
          )
        })}
      </ol>
    </details>
  )
}

/** Ce qu'un stagiaire a répondu, question par question (bonne réponse rappelée si erreur). */
function ReponsesStagiaire({ questions, details }: { questions: QuestionCorrige[]; details: Map<string, DetailQuestion> | undefined }) {
  return (
    <ol className="space-y-2 border-t border-surface-100 bg-surface-50/60 px-3 py-3">
      {questions.map((q, i) => {
        const d = details?.get(q.id)
        const choix = choixTries(q)
        const coches = (d?.choix_ids || []).map((id) => choix.find((c) => c.id === id)?.texte).filter(Boolean) as string[]
        const attendues = choix.filter((c) => c.est_correct === true).map((c) => c.texte)
        const avecCorrige = attendues.length > 0
        const juste = d?.est_correct === true
        const reponse = coches.length ? coches.join(', ') : d?.texte_libre?.trim() || (d?.note_valeur != null ? String(d.note_valeur) : 'Sans réponse')
        return (
          <li key={q.id} className="flex items-start gap-2 text-xs">
            {avecCorrige
              ? (juste ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-600" />)
              : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-surface-300" />}
            <div className="min-w-0">
              <div className="text-surface-700">{i + 1}. {q.texte}</div>
              <div className={avecCorrige ? (juste ? 'font-medium text-emerald-700' : 'font-medium text-danger-700') : 'text-surface-600'}>{reponse}</div>
              {avecCorrige && !juste && <div className="text-surface-500">Bonne réponse : {attendues.join(', ')}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

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
  questions = [],
  details = [],
}: {
  token: string
  basePath: string
  sessionId: string
  qcmSessions: QcmSession[]
  qcmReponses: QcmReponse[]
  stagiaires: Stagiaire[]
  /** Questions et corrigé des questionnaires de la session (vue formateur uniquement) */
  questions?: QuestionCorrige[]
  /** Réponses question par question des stagiaires */
  details?: DetailQuestion[]
}) {
  const nbStagiaires = stagiaires.length
  const questionsParQcm = new Map<string, QuestionCorrige[]>()
  for (const q of [...questions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    const l = questionsParQcm.get(q.qcm_id) || []; l.push(q); questionsParQcm.set(q.qcm_id, l)
  }
  const detailsParReponse = new Map<string, Map<string, DetailQuestion>>()
  for (const d of details) {
    const m = detailsParReponse.get(d.reponse_id) || new Map<string, DetailQuestion>()
    m.set(d.question_id, d); detailsParReponse.set(d.reponse_id, m)
  }

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
              const qList = questionsParQcm.get(qs.qcm_id) || []
              // Satisfaction : résultats d'ensemble seulement, pas qui a répondu quoi
              const satisfaction = !!qs.qcm?.type?.startsWith('satisfaction')
              const completes = rep.filter((r) => r.is_complete)

              return (
                <div key={qs.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap">
                    {/* Largeur minimale : sur téléphone, le bouton passe sous le titre au lieu de l'écraser */}
                    <div className="min-w-[14rem] flex-1">
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
                          const ligne = (
                            <div className="flex items-center gap-3 px-3 py-2.5">
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
                              {fait && !satisfaction && qList.length > 0 && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-surface-400 transition-transform group-open/stag:rotate-180" />}
                            </div>
                          )
                          // Un stagiaire qui a répondu : on déplie pour voir ses réponses
                          return fait && !satisfaction && qList.length > 0 && r?.id ? (
                            <details key={s.id} className="group/stag">
                              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{ligne}</summary>
                              <ReponsesStagiaire questions={qList} details={detailsParReponse.get(r.id)} />
                            </details>
                          ) : (
                            <div key={s.id}>{ligne}</div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {qList.length > 0 && (
                    <Corrige questions={qList} completes={completes} detailsParReponse={detailsParReponse} satisfaction={satisfaction} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="px-4 py-2 bg-surface-50/60 text-[11px] text-surface-500">
            Ouvrez chaque questionnaire quand le cours en est là : il apparaît en quelques secondes sur le téléphone des stagiaires. Une fois ouvert, il ne se referme pas.
          </div>
        </div>
      )}
    </div>
  )
}
