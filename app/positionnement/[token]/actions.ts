'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { evaluerPositionnement, nettoyerReponses, questionnairePourParcours, type Reponses } from '@/lib/poei-positionnement'

export interface ResultatEnvoi {
  success: boolean
  error?: string
  data?: { note: number; justes: number; total: number }
}

/**
 * Enregistre les réponses d'un candidat. Accès par le seul lien personnel :
 * pas de compte, pas de mot de passe. Un questionnaire déjà rendu ne se
 * réécrit pas. Le questionnaire corrigé et la durée du parcours sont figés
 * avec les résultats : un barème qui change ne réécrit pas un document transmis.
 */
export async function repondrePositionnementAction(token: string, reponses: Reponses): Promise<ResultatEnvoi> {
  if (!token) return { success: false, error: 'Lien invalide' }
  const supabase = await createServiceRoleClient()

  const { data: pos } = await supabase
    .from('poei_positionnements')
    .select('id, statut, poei:poei_id(duree_heures, formation:formations(intitule), client:client_id(raison_sociale, nom_commercial))')
    .eq('token', token).maybeSingle()
  if (!pos) return { success: false, error: 'Questionnaire introuvable' }
  if (pos.statut === 'complete') return { success: false, error: 'Ce questionnaire a déjà été rendu' }

  const poei: any = (pos as any).poei
  const q = questionnairePourParcours({
    formation: poei?.formation?.intitule,
    entreprise: poei?.client?.nom_commercial || poei?.client?.raison_sociale,
  })
  const propres = nettoyerReponses(q, reponses)
  if (Object.keys(propres).length === 0) return { success: false, error: 'Répondez à au moins une question' }

  const resultat = evaluerPositionnement(propres, q, poei?.duree_heures)
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
