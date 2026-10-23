'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

/** Plafonds des dépôts : le lien ouvre le formulaire mais n'est pas à usage unique. */
const MAX_PAR_SESSION = 3
// Plafonds contre l'envoi en nombre ; formateur : tous les formateurs peuvent répondre le même jour (indicateur 30)
const MAX_PAR_JOUR: Record<string, number> = { entreprise: 20, financeur: 10, formateur: 60 }

/**
 * Dépôt public d'une appréciation (indicateur 30) — entreprise cliente après
 * une session, ou financeur dans le cadre de la sollicitation annuelle.
 *
 * Le lien porte l'identifiant de la session (entreprise) ou de l'organisation
 * (financeur, formateur), sans compte. Ces identifiants ne sont pas secrets :
 * un stagiaire voit celui de sa session, celui de l'organisation est public.
 * D'où les garde-fous : champ piège, une session n'accepte d'appréciation
 * qu'une fois la demande partie vers son client, et les dépôts sont plafonnés
 * par session et par jour.
 */
export async function deposerAppreciationAction(
  cible: string,
  formData: FormData,
): Promise<ActionResult> {
  if (String(formData.get('site_web') || '').trim() !== '') return { success: true }

  const supabase = await createServiceRoleClient()
  const note = (champ: string) => {
    const v = Number(formData.get(champ))
    return v >= 1 && v <= 5 ? v : null
  }

  // La cible est soit une session (appréciation entreprise), soit
  // l'organisation elle-même (appréciation financeur).
  const { data: session } = await supabase.from('sessions')
    .select('id, organization_id, client_id').eq('id', cible).maybeSingle()
  let organizationId: string | null = null
  let type = 'entreprise'
  let sessionId: string | null = null
  let clientId: string | null = null

  if (session) {
    // La demande ne part que vers le client de la session : sans client, aucun lien n'a été envoyé
    if (!(session as any).client_id) return { success: false, error: 'Lien invalide' }
    organizationId = (session as any).organization_id
    sessionId = (session as any).id
    clientId = (session as any).client_id
  } else {
    const { data: org } = await supabase.from('organizations').select('id').eq('id', cible).maybeSingle()
    if (!org) return { success: false, error: 'Lien invalide' }
    organizationId = (org as any).id
    type = formData.get('role') === 'formateur' ? 'formateur' : 'financeur'
  }

  if (!note('note_globale')) return { success: false, error: 'Merci d’indiquer au moins la note globale.' }

  // Volume du jour ; pour une session, dépôts déjà reçus et trace de la demande (mail ou journal de l'envoi)
  const orgId = organizationId as string
  const appreciations = () => supabase.from('appreciations_parties_prenantes').select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId).eq('type', type)
  const aucun = Promise.resolve({ count: 0 })
  const [duJour, parSession, mailDemande, journalDemande] = await Promise.all([
    appreciations().gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString()),
    sessionId ? appreciations().eq('session_id', sessionId) : aucun,
    sessionId
      ? supabase.from('email_logs').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('entity_type', 'session').eq('entity_id', sessionId).ilike('subject', 'Votre appréciation%')
      : aucun,
    sessionId
      ? supabase.from('audit_logs').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('entity_type', 'session').eq('entity_id', sessionId).eq('action', 'send_appreciation_entreprise')
      : aucun,
  ])
  if (sessionId && !(mailDemande.count || 0) && !(journalDemande.count || 0)) {
    return { success: false, error: 'Ce lien d’appréciation n’est pas actif pour cette formation. Pour nous donner votre avis, écrivez-nous à digital@lab-learning.fr.' }
  }
  if ((parSession.count || 0) >= MAX_PAR_SESSION) {
    return { success: false, error: 'Plusieurs appréciations sont déjà enregistrées pour cette formation. Pour compléter la vôtre, écrivez-nous à digital@lab-learning.fr.' }
  }
  if ((duJour.count || 0) >= (MAX_PAR_JOUR[type] || 10)) {
    return { success: false, error: 'Beaucoup d’appréciations nous sont parvenues aujourd’hui. Réessayez demain, ou écrivez-nous à digital@lab-learning.fr.' }
  }

  const { error } = await supabase.from('appreciations_parties_prenantes').insert({
    organization_id: organizationId,
    type,
    session_id: sessionId,
    client_id: clientId,
    note_globale: note('note_globale'),
    note_organisation: note('note_organisation'),
    note_intervenant: note('note_intervenant'),
    recommande: formData.get('recommande') === 'oui' ? true : formData.get('recommande') === 'non' ? false : null,
    commentaire: String(formData.get('commentaire') || '').trim().slice(0, 3000) || null,
    repondant_nom: String(formData.get('nom') || '').trim().slice(0, 120) || null,
    repondant_fonction: String(formData.get('fonction') || '').trim().slice(0, 120) || null,
    repondant_email: String(formData.get('email') || '').trim().slice(0, 200) || null,
  })
  if (error) {
    console.error('[appréciation publique]', error)
    return { success: false, error: 'Une erreur est survenue — vous pouvez nous écrire à digital@lab-learning.fr.' }
  }
  return { success: true }
}
