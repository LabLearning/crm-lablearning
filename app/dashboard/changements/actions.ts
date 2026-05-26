'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type Result = { success: true } | { success: false; error: string }

/**
 * Le gestionnaire valide une demande de changement → applique sur les inscriptions :
 *  - retrait : inscription de l'apprenant concerné → 'annule'
 *  - ajout : crée l'apprenant (si besoin) + inscription 'confirme'
 *  - remplacement : annule l'ancien + crée le nouveau
 */
export async function validateChangeAction(id: string, reponse?: string): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: d } = await supabase
    .from('demandes_changement_participants')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!d) return { success: false, error: 'Demande introuvable' }
  if (d.statut !== 'en_attente') return { success: false, error: 'Demande déjà traitée' }

  // Retrait de l'ancien participant
  const removeOld = async () => {
    if (!d.apprenant_id) return
    await supabase
      .from('inscriptions')
      .update({ status: 'annule', date_annulation: new Date().toISOString(), motif_annulation: 'Changement validé (formateur)' })
      .eq('session_id', d.session_id)
      .eq('apprenant_id', d.apprenant_id)
      .eq('organization_id', orgId)
  }

  // Ajout d'un nouveau participant : crée apprenant + inscription
  const addNew = async () => {
    if (!d.nouveau_nom) return
    // Rattacher au même établissement que la session (intra) si possible
    const { data: sess } = await supabase
      .from('sessions').select('client_id').eq('id', d.session_id).single()
    const { data: appr } = await supabase
      .from('apprenants')
      .insert({
        organization_id: orgId,
        client_id: sess?.client_id || null,
        nom: d.nouveau_nom,
        prenom: d.nouveau_prenom || '',
        email: d.nouveau_email || null,
        telephone: d.nouveau_telephone || null,
      })
      .select('id')
      .single()
    if (appr) {
      await supabase.from('inscriptions').insert({
        organization_id: orgId,
        session_id: d.session_id,
        apprenant_id: appr.id,
        status: 'confirme',
        date_inscription: new Date().toISOString(),
      })
    }
  }

  try {
    if (d.type === 'retrait') await removeOld()
    else if (d.type === 'ajout') await addNew()
    else if (d.type === 'remplacement') { await removeOld(); await addNew() }
  } catch (e: any) {
    return { success: false, error: 'Erreur lors de l\'application : ' + (e?.message || '') }
  }

  await supabase
    .from('demandes_changement_participants')
    .update({ statut: 'validee', validated_by: session.user.id, validated_at: new Date().toISOString(), reponse_gestionnaire: reponse || null })
    .eq('id', id)

  await logAudit({ action: 'validate_change', entity_type: 'demande_changement', entity_id: id })
  revalidatePath('/dashboard/changements')
  revalidatePath(`/dashboard/sessions/${d.session_id}`)
  return { success: true }
}

export async function refuseChangeAction(id: string, reponse?: string): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('demandes_changement_participants')
    .update({ statut: 'refusee', validated_by: session.user.id, validated_at: new Date().toISOString(), reponse_gestionnaire: reponse || null })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    .eq('statut', 'en_attente')
  if (error) return { success: false, error: error.message }
  await logAudit({ action: 'refuse_change', entity_type: 'demande_changement', entity_id: id })
  revalidatePath('/dashboard/changements')
  return { success: true }
}
