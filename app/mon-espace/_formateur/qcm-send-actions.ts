'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { getPortalContext } from '@/lib/portal-auth'
import type { ActionResult } from '@/lib/types'

/** Envois permis par formateur sur 24 heures glissantes : chacun part en mail, en WhatsApp (facturé) et en notification à tous les inscrits. */
const ENVOIS_PAR_JOUR = 10
const ACTION_JOURNAL = 'envoi_questionnaire_apprenants'

async function resolveFormateur(token: string | null) {
  const supabase = await createServiceRoleClient()
  if (token) {
    const ctx = await getPortalContext(token)
    if (ctx && ctx.type === 'formateur') return { supabase, formateurId: ctx.formateur.id as string, orgId: ctx.organization.id as string, userId: null as string | null }
  }
  try {
    const session = await getSession()
    if (session.user.role !== 'formateur') return null
    const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', session.user.id).single()
    if (!f) return null
    return { supabase, formateurId: f.id as string, orgId: session.organization.id as string, userId: session.user.id as string | null }
  } catch { return null }
}

/**
 * Compte l'envoi dans le journal (audit_logs) AVANT de prévenir les stagiaires,
 * puis vérifie : un seul envoi par session et par type de questionnaire (le
 * message ne dépend que du type) sur 24 heures, et pas plus de ENVOIS_PAR_JOUR
 * envois par formateur. La ligne est écrite d'abord, pour que des appels lancés
 * en parallèle ne passent pas tous. Renvoie l'id de la ligne, ou le motif du
 * refus (la ligne est alors retirée).
 */
async function reserverEnvoi(
  supabase: any, orgId: string, formateurId: string, userId: string | null,
  sessionId: string, qcmId: string, type: string | null,
): Promise<{ id: string } | { refus: string }> {
  const indisponible = "L'envoi est momentanément indisponible — réessayez dans un instant."
  let auteur = userId
  if (!auteur) {
    const { data: fiche } = await supabase.from('formateurs').select('user_id').eq('id', formateurId).maybeSingle()
    auteur = fiche?.user_id || null
  }
  const { data: ligne, error } = await supabase.from('audit_logs').insert({
    organization_id: orgId,
    user_id: auteur,
    action: ACTION_JOURNAL,
    entity_type: 'formateur',
    entity_id: formateurId,
    details: { session_id: sessionId, qcm_id: qcmId, type },
  }).select('id').single()
  if (error || !ligne) return { refus: indisponible }

  const { data: recents, error: erreurLecture } = await supabase.from('audit_logs')
    .select('details')
    .eq('entity_type', 'formateur').eq('entity_id', formateurId).eq('action', ACTION_JOURNAL)
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  const lignes = (recents || []) as any[]
  const memeEnvoi = lignes.filter((r) => r.details?.session_id === sessionId && (r.details?.type ?? null) === type).length
  const refus = erreurLecture ? indisponible
    : memeEnvoi > 1 ? 'Un questionnaire de ce type a déjà été envoyé aux apprenants de cette session il y a moins de 24 heures : vous pourrez relancer demain.'
    : lignes.length > ENVOIS_PAR_JOUR ? `Vous avez atteint la limite de ${ENVOIS_PAR_JOUR} envois de questionnaires sur 24 heures : réessayez demain.`
    : null
  if (!refus) return { id: ligne.id }
  await supabase.from('audit_logs').delete().eq('id', ligne.id)
  return { refus }
}

/**
 * Envoie un questionnaire aux apprenants inscrits d'une session : sème les
 * réponses (accès portail) puis notifie chacun (email brandé + WhatsApp si
 * opt-in + notification in-app), avec un lien vers son espace questionnaires.
 */
export async function sendQcmToApprenantsAction(sessionId: string, qcmId: string, token: string | null): Promise<ActionResult & { data?: { count: number } }> {
  const ctx = await resolveFormateur(token)
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, formateurId } = ctx

  // La session doit appartenir au formateur ; le QCM à son organisation, et
  // être rattaché à la session, comme ceux que son écran propose
  const [{ data: sess }, { data: qcm }, { data: lien }] = await Promise.all([
    supabase.from('sessions').select('id').eq('id', sessionId).eq('formateur_id', formateurId).maybeSingle(),
    supabase.from('qcm').select('id, type').eq('id', qcmId).eq('organization_id', ctx.orgId).maybeSingle(),
    supabase.from('qcm_sessions').select('id').eq('session_id', sessionId).eq('qcm_id', qcmId).limit(1).maybeSingle(),
  ])
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!qcm || !lien) return { success: false, error: 'Questionnaire introuvable' }

  const { seedQcmReponsesForQcm, notifyApprenantsForQcm } = await import('@/lib/qcm-auto-seed')
  // 1) S'assurer que chaque apprenant inscrit a bien sa réponse (accès portail)
  await seedQcmReponsesForQcm(supabase, sessionId, qcmId)

  // 2) Pas de rafale : l'envoi est compté avant de partir
  const reservation = await reserverEnvoi(supabase, ctx.orgId, formateurId, ctx.userId, sessionId, qcmId, (qcm as any).type ?? null)
  if ('refus' in reservation) return { success: false, error: reservation.refus }

  // 3) Notifier (email + WhatsApp + notif) pour ce type de questionnaire
  try {
    await notifyApprenantsForQcm(supabase, sessionId, qcm.type as any)
  } catch (e) {
    // Envoi interrompu : il pourra être relancé sans attendre 24 heures
    console.error('[envoi questionnaire]', e)
    await supabase.from('audit_logs').delete().eq('id', reservation.id)
    return { success: false, error: "L'envoi a échoué — réessayez dans un instant." }
  }

  // Compter les destinataires (apprenants inscrits actifs)
  const { count } = await supabase
    .from('inscriptions').select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')

  return { success: true, data: { count: count || 0 } }
}
