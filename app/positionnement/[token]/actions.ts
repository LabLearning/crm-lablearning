'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { evaluerPositionnement, QUESTIONS, type Reponses } from '@/lib/poei-positionnement'

export interface ResultatEnvoi {
  success: boolean
  error?: string
  data?: { note: number; justes: number; total: number }
}

/**
 * Enregistre les réponses d'un candidat. Accès par le seul lien personnel :
 * pas de compte, pas de mot de passe. Un questionnaire déjà rendu ne se
 * réécrit pas.
 */
export async function repondrePositionnementAction(token: string, reponses: Reponses): Promise<ResultatEnvoi> {
  if (!token) return { success: false, error: 'Lien invalide' }
  const supabase = await createServiceRoleClient()

  const { data: pos } = await supabase
    .from('poei_positionnements').select('id, statut').eq('token', token).maybeSingle()
  if (!pos) return { success: false, error: 'Questionnaire introuvable' }
  if (pos.statut === 'complete') return { success: false, error: 'Ce questionnaire a déjà été rendu' }

  // On ne garde que les codes du référentiel, et des index de choix plausibles
  const propres: Reponses = {}
  for (const q of QUESTIONS) {
    const v = reponses[q.code]
    if (v === null || v === undefined) continue
    const n = Number(v)
    if (Number.isInteger(n) && n >= 0 && n < q.choix.length) propres[q.code] = n
  }
  if (Object.keys(propres).length === 0) return { success: false, error: 'Répondez à au moins une question' }

  const resultat = evaluerPositionnement(propres)
  const { error } = await supabase.from('poei_positionnements').update({
    reponses: propres,
    resultats: resultat,
    note: resultat.note,
    maitrise_globale: resultat.maitriseGlobale,
    heures_preconisees: resultat.heuresPreconisees,
    heures_referentiel: resultat.heuresReferentiel,
    niveau: resultat.niveau,
    statut: 'complete',
    complete_le: new Date().toISOString(),
    realise_le: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  }).eq('id', pos.id)
  if (error) {
    console.error('[positionnement réponse]', error)
    return { success: false, error: 'Enregistrement impossible, réessayez' }
  }
  return { success: true, data: { note: resultat.note, justes: resultat.justes, total: resultat.nbQuestions } }
}
