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
  const horairesJours = parsed.data.horaires_jours ? safeParseJson(parsed.data.horaires_jours) : []
  const apprenantIds = (parsed.data.apprenant_ids || '').split(',').filter(Boolean)

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      organization_id: session.organization.id,
      formation_id: parsed.data.formation_id,
      type_session: parsed.data.type_session || 'inter',
      modalite: parsed.data.modalite || 'presentiel',
      client_id: parsed.data.client_id || null,
      reference: ref,
      intitule: parsed.data.intitule || null,
      date_debut: parsed.data.date_debut,
      date_fin: parsed.data.date_fin,
      horaires: parsed.data.horaires || null,
      horaires_jours: horairesJours,
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

  // Inscrire les apprenants sélectionnés
  if (apprenantIds.length > 0) {
    await supabase.from('inscriptions').insert(
      apprenantIds.map(aid => ({
        organization_id: session.organization.id,
        session_id: data.id,
        apprenant_id: aid,
        status: 'inscrit',
      }))
    )
  }

  // Lier les formations multiples (table de jonction session_formations)
  const formationIds = (parsed.data.formation_ids || parsed.data.formation_id || '').split(',').filter(Boolean)
  if (formationIds.length > 0) {
    await supabase.from('session_formations').insert(
      formationIds.map((fid, i) => ({ session_id: data.id, formation_id: fid, ordre: i }))
    )
  }

  if (hasFormateur && parsed.data.formateur_id) {
    await notifyFormateurOfMission(parsed.data.formateur_id, data.id, supabase, session)
  }

  await logAudit({ action: 'create', entity_type: 'session', entity_id: data.id })
  revalidatePath('/dashboard/sessions')
  return { success: true, data }
}

function safeParseJson(s: string): any[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
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
    .select('reference, date_debut, date_fin, formation:formation_id(intitule)')
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
    .select('id, formateur_id, mission_status, organization_id, mission_proposed_by, formation_id, client_id, type_session, date_debut, date_fin, lieu, formation:formation_id(intitule, duree_heures, tarif_inter_ht, tarif_intra_ht)')
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

  // ── AUTO : créer une convention en brouillon pour cette session ──
  const { count: existingConv } = await supabase
    .from('conventions').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)

  if (!existingConv && sess.client_id) {
    // Compter les apprenants inscrits
    const { count: nbApprenants } = await supabase
      .from('inscriptions').select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')

    // Numéro de convention : CV-YYYY-NNN
    const { count: convCount } = await supabase
      .from('conventions').select('*', { count: 'exact', head: true })
      .eq('organization_id', sess.organization_id)
    const numero = `CV-${new Date().getFullYear()}-${String((convCount || 0) + 1).padStart(3, '0')}`

    const formation = (sess as any).formation
    const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
    const montantHt = tarifBase ? tarifBase * (nbApprenants || 1) : null

    await supabase.from('conventions').insert({
      organization_id: sess.organization_id,
      numero,
      type: sess.type_session === 'intra' ? 'intra_entreprise' : 'inter_entreprise',
      session_id: sessionId,
      client_id: sess.client_id,
      formation_id: sess.formation_id,
      status: 'brouillon',
      objet: `Convention de formation — ${formation?.intitule || 'Formation'}`,
      nombre_stagiaires: nbApprenants || 0,
      duree_heures: formation?.duree_heures || null,
      lieu: sess.lieu || null,
      dates_formation: `Du ${sess.date_debut} au ${sess.date_fin}`,
      montant_ht: montantHt,
      taux_tva: 20,
      montant_ttc: montantHt ? montantHt * 1.2 : null,
      created_by: sess.mission_proposed_by || session.user.id,
    })
  }

  // Notifier le gestionnaire qui a proposé
  if (sess.mission_proposed_by) {
    const { createNotification } = await import('@/lib/email')
    await createNotification({
      organizationId: sess.organization_id,
      userId: sess.mission_proposed_by,
      titre: 'Mission acceptée — convention en brouillon',
      message: `${session.user.first_name} ${session.user.last_name} a accepté la mission "${(sess as any).formation?.intitule || 'Formation'}". Une convention a été créée en brouillon, prête à être envoyée au client.`,
      type: 'session',
      lienUrl: `/dashboard/conventions`,
      lienLabel: 'Voir la convention',
      entityType: 'session',
      entityId: sessionId,
    })
  }

  await logAudit({ action: 'accept_mission', entity_type: 'session', entity_id: sessionId })
  revalidatePath('/mon-espace')
  revalidatePath('/dashboard/sessions')
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

export async function refuseMissionAction(sessionId: string, comment: string): Promise<ActionResult> {
  if (!comment.trim()) return { success: false, error: 'Un motif de refus est requis' }
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('formateur_id, mission_status, organization_id, mission_proposed_by, formation:formation_id(intitule)')
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

  const horairesJours = parsed.data.horaires_jours ? safeParseJson(parsed.data.horaires_jours) : []

  const { error } = await supabase
    .from('sessions')
    .update({
      formation_id: parsed.data.formation_id,
      type_session: parsed.data.type_session || 'inter',
      modalite: parsed.data.modalite || 'presentiel',
      client_id: parsed.data.client_id || null,
      reference: parsed.data.reference || undefined,
      intitule: parsed.data.intitule || null,
      date_debut: parsed.data.date_debut,
      date_fin: parsed.data.date_fin,
      horaires: parsed.data.horaires || null,
      horaires_jours: horairesJours,
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

  // Synchroniser les formations liées : remplace tout
  const newFormationIds = (parsed.data.formation_ids || parsed.data.formation_id || '').split(',').filter(Boolean)
  await supabase.from('session_formations').delete().eq('session_id', id)
  if (newFormationIds.length > 0) {
    await supabase.from('session_formations').insert(
      newFormationIds.map((fid, i) => ({ session_id: id, formation_id: fid, ordre: i }))
    )
  }

  // Synchroniser les inscriptions apprenants : ajoute les nouveaux, garde les existants
  const newApprenantIds = (parsed.data.apprenant_ids || '').split(',').filter(Boolean)
  if (newApprenantIds.length > 0) {
    const { data: existing } = await supabase
      .from('inscriptions').select('apprenant_id').eq('session_id', id)
    const existingIds = new Set((existing || []).map(e => e.apprenant_id))
    const toInsert = newApprenantIds.filter(aid => !existingIds.has(aid))
    if (toInsert.length > 0) {
      await supabase.from('inscriptions').insert(
        toInsert.map(aid => ({
          organization_id: session.organization.id,
          session_id: id,
          apprenant_id: aid,
          status: 'inscrit',
        }))
      )
    }
  }

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

  // À la fin de la session → seed QCM sortie + satisfaction à chaud
  if (status === 'terminee') {
    const { seedQcmReponsesForSession, notifyApprenantsForQcm } = await import('@/lib/qcm-auto-seed')
    for (const t of ['sortie', 'satisfaction_chaud'] as const) {
      const r = await seedQcmReponsesForSession(supabase, id, t)
      if (r.created > 0) await notifyApprenantsForQcm(supabase, id, t)
    }
  }

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
