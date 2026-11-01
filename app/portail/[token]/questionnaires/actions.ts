'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { enregistrerReponses } from '@/lib/qcm-notation'

export async function submitQcmAction(
  token: string,
  qcmReponseId: string,
  // Map of question_id → answer (choix_id for qcm/vrai_faux, free text for texte_libre, note value for note types)
  answers: Record<string, string>
): Promise<{ success: boolean; score?: number; isReussi?: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'apprenant') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  // Fetch the qcm_reponse and verify ownership
  const { data: reponse, error: reponseError } = await supabase
    .from('qcm_reponses')
    .select('id, qcm_id, qcm_session_id, is_complete, apprenant_id, organization_id, session_id, qcm:qcm_id(type)')
    .eq('id', qcmReponseId)
    .eq('apprenant_id', context.apprenant.id)
    .single()

  if (reponseError || !reponse) {
    return { success: false, error: 'Questionnaire introuvable' }
  }

  if (reponse.is_complete) {
    return { success: false, error: 'Déjà soumis' }
  }

  // Questionnaire pas encore ouvert par le formateur : rien ne s'enregistre
  const { reponseOuverte } = await import('@/lib/qcm-ouverture')
  if (!(await reponseOuverte(supabase, (reponse as any).qcm_session_id))) {
    return { success: false, error: 'Ce questionnaire n’est pas encore ouvert : votre formateur l’ouvrira pendant le cours.' }
  }

  // Verrou J+90 côté serveur : le questionnaire à froid ne peut pas être
  // soumis avant trois mois après la fin de session, quel que soit le client.
  if ((reponse as any).qcm?.type === 'satisfaction_froid' && (reponse as any).session_id) {
    const { data: sess } = await supabase.from('sessions')
      .select('date_fin').eq('id', (reponse as any).session_id).maybeSingle()
    if (sess?.date_fin) {
      const dispo = new Date(sess.date_fin + 'T00:00:00Z')
      dispo.setUTCDate(dispo.getUTCDate() + 90)
      if (new Date() < dispo) {
        return { success: false, error: `Ce questionnaire sera disponible le ${dispo.toLocaleDateString('fr-FR')} (trois mois après la formation)` }
      }
    }
  }

  // La notation partagée fait foi (lib/qcm-notation) : pourcentage sur les
  // questions notables, moyenne des échelles sinon, null quand rien ne se
  // note — jamais un faux 0 % sur un positionnement d'auto-évaluation.
  const r = await enregistrerReponses(supabase, qcmReponseId, reponse.qcm_id, answers)
  if (!r.success) return { success: false, error: r.error }

  return {
    success: true,
    score: r.data?.score ?? undefined,
    isReussi: r.data?.isReussi ?? undefined,
  }
}
