'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { enregistrerReponses } from '@/lib/qcm-notation'

/** Questionnaires que la grille propose (page.tsx) : la satisfaction à froid, à J+90, revient au stagiaire seul. */
const TYPES_GRILLE = ['positionnement', 'entree', 'sortie', 'satisfaction_chaud']

/**
 * Enregistre les réponses d'une grille (un questionnaire × plusieurs
 * stagiaires) saisie par le formateur depuis son portail. Chaque stagiaire
 * passe par la notation partagée : score, détail question par question,
 * progression — exactement comme une saisie faite dans le dashboard.
 */
export async function enregistrerGrillePortailAction(
  token: string,
  sessionId: string,
  qcmId: string,
  parApprenant: Record<string, Record<string, string>>,
): Promise<{ success: boolean; error?: string; faits?: string[] }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  // La session doit être à ce formateur.
  const { data: sess } = await supabase.from('sessions')
    .select('id, organization_id, date_debut, date_fin').eq('id', sessionId)
    .eq('formateur_id', (context as any).formateur.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  // Le questionnaire doit être rattaché à cette session et figurer dans la
  // grille ; les réponses ne vont qu'à ses inscrits.
  const [{ data: lien }, { data: qcmInfo }, { data: inscriptions }] = await Promise.all([
    supabase.from('qcm_sessions').select('id').eq('session_id', sessionId).eq('qcm_id', qcmId).limit(1).maybeSingle(),
    supabase.from('qcm').select('type').eq('id', qcmId).maybeSingle(),
    supabase.from('inscriptions').select('apprenant_id').eq('session_id', sessionId),
  ])
  if (!lien || !qcmInfo) return { success: false, error: 'Questionnaire introuvable pour cette session' }
  if (!TYPES_GRILLE.includes((qcmInfo as any).type)) {
    return { success: false, error: 'Ce questionnaire ne se remplit pas depuis la grille.' }
  }
  const inscrits = new Set(((inscriptions || []) as any[]).map((i) => i.apprenant_id).filter(Boolean))

  // Chaque questionnaire à son heure : pas de saisie prématurée, même par
  // l'API — le dossier doit rester chronologiquement cohérent.
  const aujourdHui = new Date().toISOString().slice(0, 10)
  const commencee = (sess as any).date_debut && String((sess as any).date_debut).slice(0, 10) <= aujourdHui
  const finie = (sess as any).date_fin ? String((sess as any).date_fin).slice(0, 10) < aujourdHui : commencee
  const type = (qcmInfo as any)?.type
  if (['positionnement', 'entree'].includes(type) && !commencee) {
    return { success: false, error: 'Le positionnement se remplit à partir du premier jour de la session.' }
  }
  if (['sortie', 'satisfaction_chaud', 'satisfaction_froid'].includes(type) && !finie) {
    return { success: false, error: "L'évaluation des acquis et la satisfaction se remplissent une fois la session terminée." }
  }

  const faits: string[] = []
  for (const [apprenantId, reponses] of Object.entries(parApprenant || {})) {
    if (!inscrits.has(apprenantId)) continue
    const remplies = Object.values(reponses || {}).filter((v) => String(v || '').trim() !== '').length
    if (!remplies) continue

    // Ligne de réponse en attente (créée si absente — inscription tardive).
    let { data: ligne } = await supabase.from('qcm_reponses')
      .select('id, is_complete').eq('session_id', sessionId).eq('qcm_id', qcmId)
      .eq('apprenant_id', apprenantId).maybeSingle()
    if (ligne?.is_complete) continue
    if (!ligne) {
      const { data: creee, error } = await supabase.from('qcm_reponses').insert({
        organization_id: (sess as any).organization_id,
        session_id: sessionId, qcm_id: qcmId, apprenant_id: apprenantId, is_complete: false,
      }).select('id, is_complete').single()
      if (error) { console.error('[grille portail]', error.message); continue }
      ligne = creee
    }

    const r = await enregistrerReponses(supabase, (ligne as any).id, qcmId, reponses)
    if (r.success) faits.push(apprenantId)
  }

  if (!faits.length) return { success: false, error: 'Aucune réponse à enregistrer — remplissez au moins un stagiaire.' }
  return { success: true, faits }
}
