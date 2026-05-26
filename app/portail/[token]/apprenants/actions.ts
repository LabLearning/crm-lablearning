'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Le formateur déclare un changement de participant (ajout / retrait / remplacement).
 * Crée une demande (ticket) que le gestionnaire devra valider. Ne modifie PAS
 * directement les inscriptions.
 */
export async function declareParticipantChangeAction(
  token: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const sessionId = formData.get('session_id') as string
  const type = formData.get('type') as string // ajout / retrait / remplacement
  if (!sessionId || !type) return { success: false, error: 'Informations manquantes' }

  // Vérifier que la session appartient bien au formateur
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, reference, formateur_id, formation:formation_id(intitule)')
    .eq('id', sessionId)
    .single()
  if (!sess || sess.formateur_id !== context.formateur.id) {
    return { success: false, error: 'Session non autorisée' }
  }

  const apprenantId = (formData.get('apprenant_id') as string) || null
  const nouveauNom = (formData.get('nouveau_nom') as string || '').trim() || null
  const nouveauPrenom = (formData.get('nouveau_prenom') as string || '').trim() || null

  // Validation selon le type
  if ((type === 'retrait' || type === 'remplacement') && !apprenantId) {
    return { success: false, error: 'Sélectionnez le participant concerné' }
  }
  if ((type === 'ajout' || type === 'remplacement') && !nouveauNom) {
    return { success: false, error: 'Renseignez le nom du nouveau participant' }
  }

  const { data: demande, error } = await supabase
    .from('demandes_changement_participants')
    .insert({
      organization_id: sess.organization_id,
      session_id: sessionId,
      formateur_id: context.formateur.id,
      type,
      apprenant_id: apprenantId,
      nouveau_nom: nouveauNom,
      nouveau_prenom: nouveauPrenom,
      nouveau_email: (formData.get('nouveau_email') as string || '').trim() || null,
      nouveau_telephone: (formData.get('nouveau_telephone') as string || '').trim() || null,
      motif: (formData.get('motif') as string || '').trim() || null,
      statut: 'en_attente',
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Notifier les gestionnaires / admins
  try {
    const { createNotifications } = await import('@/lib/email')
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', sess.organization_id)
      .in('role', ['super_admin', 'gestionnaire'])
      .eq('status', 'active')
    const formationNom = (sess as any).formation?.intitule || sess.reference
    const formateurNom = `${context.formateur.prenom || ''} ${context.formateur.nom || ''}`.trim()
    const typeLabel = type === 'ajout' ? 'Ajout' : type === 'retrait' ? 'Retrait' : 'Remplacement'
    if (admins && admins.length > 0) {
      await createNotifications(
        admins.map((u: any) => ({
          organizationId: sess.organization_id,
          userId: u.id,
          titre: 'Changement de participant à valider',
          message: `${formateurNom} demande un ${typeLabel.toLowerCase()} de participant sur "${formationNom}".`,
          type: 'action',
          lienUrl: '/dashboard/changements',
          lienLabel: 'Valider la demande',
          entityType: 'demande_changement',
          entityId: demande.id,
        })),
      )
    }
  } catch (e) {
    console.error('[declare change notify]', e)
  }

  revalidatePath(`/portail/${token}/apprenants`)
  return { success: true }
}
