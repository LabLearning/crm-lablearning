'use client'

import type { Questionnaire, Reponses, ResultatPositionnement } from '@/lib/poei-positionnement'

/**
 * Réponses d'un candidat au questionnaire de positionnement, domaine par
 * domaine : juste ou faux, ce qu'il a répondu et la réponse attendue.
 * Partagé par l'onglet Positionnement d'un projet POEI et le vivier.
 */
export function ReponsesPositionnement({ questionnaire, reponses, resultat }: {
  questionnaire: Questionnaire
  reponses: Reponses
  resultat: ResultatPositionnement
}) {
  return (
    <div className="space-y-4">
      {questionnaire.domaines.map((d) => {
        const dom = resultat.domaines.find((x) => x.code === d.code)
        return (
          <div key={d.code} className="rounded-xl border border-surface-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 bg-surface-50 border-b border-surface-100">
              <div className="text-sm font-semibold text-surface-900">
                {d.libelle}
                {d.competences && <span className="ml-1.5 text-xs font-normal text-surface-500">compétences {d.competences}</span>}
              </div>
              {dom && (
                <div className="text-xs text-surface-600 tabular-nums shrink-0">
                  {dom.justes}/{dom.total} · {dom.heuresPreconisees} h sur {dom.heuresReferentiel} h
                </div>
              )}
            </div>
            <div className="divide-y divide-surface-100">
              {questionnaire.questions.filter((q) => q.domaine === d.code).map((q) => {
                const rep = reponses[q.code]
                const juste = rep != null && Number(rep) === q.correct
                return (
                  <div key={q.code} className="px-3.5 py-2.5">
                    {q.competence && <div className="text-[11px] font-medium text-surface-400 mb-0.5">Compétence {q.competence}</div>}
                    <div className="text-sm text-surface-800">{q.intitule}</div>
                    <div className={`text-xs mt-1 ${juste ? 'text-emerald-700' : 'text-danger-600'}`}>
                      {rep == null ? 'Sans réponse' : `${juste ? 'Juste' : 'Faux'}, a répondu « ${q.choix[Number(rep)]} »`}
                    </div>
                    {!juste && <div className="text-xs text-surface-500 mt-0.5">Attendu : « {q.choix[q.correct]} »</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
