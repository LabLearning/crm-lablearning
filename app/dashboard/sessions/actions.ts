'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createSessionSchema } from '@/lib/validations/formation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createSessionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createSessionSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return { success: false, errors: fieldErrors, error: formErrors[0] }
  }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  const ref = parsed.data.reference || `SES-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const hasFormateur = !!parsed.data.formateur_id

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      organization_id: session.organization.id,
      formation_id: parsed.data.formation_id,
      reference: ref,
      intitule: parsed.data.intitule || null,
      date_debut: parsed.data.date_debut,
      date_fin: parsed.data.date_fin,
      horaires: parsed.data.horaires || null,
      lieu: parsed.data.lieu || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      lien_visio: parsed.data.lien_visio || null,
      places_min: parsed.data.places_min,
      places_max: parsed.data.places_max,
      formateur_id: parsed.data.formateur_id || null,
      status: parsed.data.status || 'planifiee',
      cout_formateur: parsed.data.cout_formateur || null,
      cout_salle: parsed.data.cout_salle || null,
      cout_materiel: parsed.data.cout_materiel || null,
      notes_internes: parsed.data.notes_internes || null,
      notes_logistiques: parsed.data.notes_logistiques || null,
      created_by: session.user.id,
      // Workflow mission : si formateur attribué → mission en attente de réponse
      mission_status: hasFormateur ? 'pending' : 'not_required',
      mission_proposed_at: hasFormateur ? new Date().toISOString() : null,
      mission_proposed_by: hasFormateur ? session.user.id : null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Session]', error)
    return { success: false, error: 'Erreur lors de la création' }
  }

  // Notifier le formateur si une mission lui est proposée
  if (hasFormateur && parsed.data.formateur_id) {
    await notifyFormateurOfMission(parsed.data.formateur_id, data.id, supabase, session)
  }

  await logAudit({ action: 'create', entity_type: 'session', entity_id: data.id })
  revalidatePath('/dashboard/sessions')
  return { success: true, data }
}

/** Helper : créer la notif "mission proposée" pour le formateur */
async function notifyFormateurOfMission(formateurId: string, sessionId: string, supabase: any, session: any) {
  const { createNotification } = await import('@/lib/email')
  // Récupérer l'user_id lié au formateur (pour la notif in-app)
  const { data: formateur } = await supabase
    .from('formateurs').select('user_id, prenom, nom').eq('id', formateurId).single()
  if (!formateur?.user_id) return  // Pas de compte user lié → pas de notif (à terme : envoyer email via token)

  const { data: sessionData } = await supabase
    .from('sessions')
    .select('reference, date_debut, date_fin, formation:formations(intitule)')
    .eq('id', sessionId).single()

  await createNotification({
    organizationId: session.organization.id,
    userId: formateur.user_id,
    titre: 'Nouvelle mission proposée',
    message: `Mission "${sessionData?.formation?.intitule || 'Formation'}" du ${new Date(sessionData?.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sessionData?.date_fin).toLocaleDateString('fr-FR')}. Acceptez ou refusez depuis votre espace.`,
    type: 'session',
    lienUrl: `/mon-espace`,
    lienLabel: 'Voir la mission',
    entityType: 'session',
    entityId: sessionId,
  })
}

// ============================================================
// Workflow mission formateur : accepter / refuser
// ============================================================

export async function acceptMissionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Vérifier que le user est bien le formateur de la session
  const { data: sess } = await supabase
    .from('sessions')
    .select('formateur_id, mission_status, organization_id, mission_proposed_by, formation:formations(intitule)')
    .eq('id', sessionId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: formateur } = await supabase
    .from('formateurs').select('id').eq('user_id', session.user.id).single()
  if (!formateur || formateur.id !== sess.formateur_id) {
    return { success: false, error: 'Cette mission ne vous est pas adressée' }
  }
  if (sess.mission_status !== 'pending') return { success: false, error: 'Cette mission n\'est plus en attente' }

  const { error } = await supabase
    .from('sessions')
    .update({ mission_status: 'accepted', mission_responded_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) return { success: false, error: 'Erreur lors de l\'acceptation' }

  // Notifier le gestionnaire qui a proposé
  if (sess.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: sess.organization_id,
      userId: sess.mission_proposed_by,
      titre: 'Mission acceptée',
      message: `${session.user.first_name} ${session.user.last_name} a accepté la mission "${(sess as any).formation?.intitule || 'Formation'}".`,
      type: 'session',
      lienUrl: `/dashboard/sessions/${sessionId}`,
      lienLabel: 'Voir la session',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  await logAudit({ action: 'accept_mission', entity_type: 'session', entity_id: sessionId })
  revalidatePath('/mon-espace')
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function refuseMissionAction(sessionId: string, comment: string): Promise<ActionResult> {
  if (!comment.trim()) return { success: false, error: 'Un motif de refus est requis' }
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('formateur_id, mission_status, organization_id, mission_proposed_by, formation:formations(intitule)')
    .eq('id', sessionId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: formateur } = await supabase
    .from('formateurs').select('id').eq('user_id', session.user.id).single()
  if (!formateur || formateur.id !== sess.formateur_id) {
    return { success: false, error: 'Cette mission ne vous est pas adressée' }
  }
  if (sess.mission_status !== 'pending') return { success: false, error: 'Cette mission n\'est plus en attente' }

  const { error } = await supabase
    .from('sessions')
    .update({
      mission_status: 'refused',
      mission_responded_at: new Date().toISOString(),
      mission_response_comment: comment,
      formateur_id: null,  // Retirer le formateur pour permettre une réattribution
    })
    .eq('id', sessionId)
  if (error) return { success: false, error: 'Erreur lors du refus' }

  // Notifier le gestionnaire qui a proposé
  if (sess.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: sess.organization_id,
      userId: sess.mission_proposed_by,
      titre: 'Mission refusée',
      message: `${session.user.first_name} ${session.user.last_name} a refusé la mission "${(sess as any).formation?.intitule || 'Formation'}". Motif : ${comment}`,
      type: 'session',
      lienUrl: `/dashboard/sessions/${sessionId}`,
      lienLabel: 'Réattribuer un formateur',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  await logAudit({ action: 'refuse_mission', entity_type: 'session', entity_id: sessionId, details: { comment } })
  revalidatePath('/mon-espace')
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function updateSessionAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createSessionSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return { success: false, errors: fieldErrors, error: formErrors[0] }
  }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      formation_id: parsed.data.formation_id,
      reference: parsed.data.reference || undefined,
      intitule: parsed.data.intitule || null,
      date_debut: parsed.data.date_debut,
      date_fin: parsed.data.date_fin,
      horaires: parsed.data.horaires || null,
      lieu: parsed.data.lieu || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      lien_visio: parsed.data.lien_visio || null,
      places_min: parsed.data.places_min,
      places_max: parsed.data.places_max,
      formateur_id: parsed.data.formateur_id || null,
      status: parsed.data.status || undefined,
      cout_formateur: parsed.data.cout_formateur || null,
      cout_salle: parsed.data.cout_salle || null,
      cout_materiel: parsed.data.cout_materiel || null,
      notes_internes: parsed.data.notes_internes || null,
      notes_logistiques: parsed.data.notes_logistiques || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'session', entity_id: id })
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function updateSessionStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'update_status', entity_type: 'session', entity_id: id, details: { status } })
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (inscriptions liées)' }

  await logAudit({ action: 'delete', entity_type: 'session', entity_id: id })
  revalidatePath('/dashboard/sessions')
  return { success: true }
}
