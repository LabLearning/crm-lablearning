'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/email'

async function notifyAssignee(
  organizationId: string,
  assigneeId: string | null,
  actorId: string,
  titre: string,
  message: string,
  tacheId: string,
  type: string = 'action',
  sendEmail: boolean = false,
) {
  if (!assigneeId || assigneeId === actorId) return
  try {
    // Notification in-app : apparaît en pop-up temps réel (toast) via la cloche
    await createNotification({
      organizationId,
      userId: assigneeId,
      titre,
      message,
      type,
      lienUrl: '/dashboard/taches',
      lienLabel: 'Voir la tâche',
      entityType: 'crm_tache',
      entityId: tacheId,
    })

    // Email (uniquement pour les assignations, pas les commentaires/déplacements)
    if (sendEmail) {
      const supabase = await createServiceRoleClient()
      const { data: assignee } = await supabase.from('users').select('email, first_name, last_name').eq('id', assigneeId).single()
      if (assignee?.email) {
        const { data: org } = await supabase.from('organizations').select('*').eq('id', organizationId).single()
        const { sendDocumentEmail } = await import('@/lib/email')
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
        await sendDocumentEmail({
          to: assignee.email,
          orgName: org?.name || 'Lab Learning',
          orgEmail: (org as any)?.email_contact || org?.email,
          orgLogoUrl: (org as any)?.logo_url,
          recipientName: [assignee.first_name, assignee.last_name].filter(Boolean).join(' ') || 'Bonjour',
          subject: `${titre} — CRM Lab Learning`,
          docTitle: titre,
          intro: `${message}. Connectez-vous au CRM pour voir le détail et traiter la tâche.`,
          ctaLabel: 'Ouvrir mes tâches',
          ctaUrl: `${appUrl}/dashboard/taches`,
        })
      }
    }
  } catch (e) {
    console.error('[notify]', e)
  }
}

async function getActorName(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('id', userId)
    .single()
  if (!data) return 'Un collaborateur'
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email
}

export type TacheStatus = 'a_faire' | 'en_cours' | 'en_revue' | 'terminee'
export type TachePriorite = 'basse' | 'moyenne' | 'haute' | 'urgente'

type ActionResult<T = unknown> = { success: true; data?: T } | { success: false; error: string }

export async function createTacheAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const titre = (formData.get('titre') as string || '').trim()
  if (!titre) return { success: false, error: 'Le titre est requis' }

  const description = (formData.get('description') as string || '').trim() || null
  const status = (formData.get('status') as TacheStatus) || 'a_faire'
  const priorite = (formData.get('priorite') as TachePriorite) || 'moyenne'
  const assignee_id = (formData.get('assignee_id') as string) || null
  const due_date = (formData.get('due_date') as string) || null
  const entity_type = (formData.get('entity_type') as string) || null
  const entity_id = (formData.get('entity_id') as string) || null
  const entity_label = (formData.get('entity_label') as string) || null
  const labelsRaw = (formData.get('labels') as string) || ''
  const labels = labelsRaw
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)

  // Position : à la fin de la colonne
  const { data: lastInColumn } = await supabase
    .from('crm_taches')
    .select('position')
    .eq('organization_id', session.organization.id)
    .eq('status', status)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (lastInColumn?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('crm_taches')
    .insert({
      organization_id: session.organization.id,
      titre,
      description,
      status,
      priorite,
      assignee_id: assignee_id || null,
      created_by: session.user.id,
      due_date,
      position,
      labels: labels.length > 0 ? labels : null,
      entity_type,
      entity_id,
      entity_label,
    })
    .select()
    .single()

  if (error) {
    console.error('[createTacheAction]', error)
    return { success: false, error: 'Erreur lors de la création' }
  }

  // Notification à l'assignee (s'il n'est pas le créateur)
  if (data.assignee_id) {
    const actorName = await getActorName(supabase, session.user.id)
    await notifyAssignee(
      session.organization.id,
      data.assignee_id,
      session.user.id,
      'Nouvelle tâche assignée',
      `${actorName} vous a assigné « ${titre} »`,
      data.id,
      'action',
      true, // pop-up + email
    )
  }

  await logAudit({ action: 'create', entity_type: 'crm_tache', entity_id: data.id })
  revalidatePath('/dashboard/taches')
  return { success: true, data }
}

export async function updateTacheAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updates: Record<string, unknown> = {}

  if (formData.has('titre')) {
    const titre = (formData.get('titre') as string || '').trim()
    if (!titre) return { success: false, error: 'Le titre est requis' }
    updates.titre = titre
  }
  if (formData.has('description')) updates.description = (formData.get('description') as string || '').trim() || null
  if (formData.has('priorite')) updates.priorite = formData.get('priorite') as TachePriorite
  if (formData.has('assignee_id')) {
    const v = formData.get('assignee_id') as string
    updates.assignee_id = v || null
  }
  if (formData.has('due_date')) updates.due_date = (formData.get('due_date') as string) || null
  if (formData.has('entity_type')) updates.entity_type = (formData.get('entity_type') as string) || null
  if (formData.has('entity_id')) updates.entity_id = (formData.get('entity_id') as string) || null
  if (formData.has('entity_label')) updates.entity_label = (formData.get('entity_label') as string) || null
  if (formData.has('labels')) {
    const labels = ((formData.get('labels') as string) || '')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
    updates.labels = labels.length > 0 ? labels : null
  }

  // Détecter changement d'assignee pour notifier
  let oldAssigneeId: string | null = null
  let oldTitre = ''
  if (formData.has('assignee_id') || formData.has('titre')) {
    const { data: before } = await supabase
      .from('crm_taches')
      .select('assignee_id, titre')
      .eq('id', id)
      .single()
    oldAssigneeId = before?.assignee_id ?? null
    oldTitre = before?.titre || ''
  }

  const { error } = await supabase
    .from('crm_taches')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  // Si nouvel assignee différent → notifier
  if (
    formData.has('assignee_id') &&
    updates.assignee_id &&
    updates.assignee_id !== oldAssigneeId
  ) {
    const actorName = await getActorName(supabase, session.user.id)
    const titre = (updates.titre as string) || oldTitre
    await notifyAssignee(
      session.organization.id,
      updates.assignee_id as string,
      session.user.id,
      'Tâche assignée',
      `${actorName} vous a assigné « ${titre} »`,
      id,
      'action',
      true, // pop-up + email
    )
  }

  await logAudit({ action: 'update', entity_type: 'crm_tache', entity_id: id })
  revalidatePath('/dashboard/taches')
  return { success: true }
}

/**
 * Drag & drop : déplace une tâche vers une colonne et une position données.
 * Met à jour le status, la position, et incrémente les positions des tâches après dans la colonne cible.
 */
export async function moveTacheAction(
  id: string,
  newStatus: TacheStatus,
  newPosition: number,
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Récupérer l'ancienne position/colonne
  const { data: current } = await supabase
    .from('crm_taches')
    .select('status, position')
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    .single()

  if (!current) return { success: false, error: 'Tâche introuvable' }

  const oldStatus = current.status as TacheStatus
  const oldPosition = current.position as number

  // Toutes les tâches concernées dans les colonnes source + cible
  const { data: tasksInTargetColumn } = await supabase
    .from('crm_taches')
    .select('id, position, status')
    .eq('organization_id', session.organization.id)
    .in('status', oldStatus === newStatus ? [newStatus] : [oldStatus, newStatus])
    .order('position')

  // Reconstituer l'ordre voulu
  const updates: { id: string; status: TacheStatus; position: number }[] = []

  if (oldStatus === newStatus) {
    // Reorder dans la même colonne
    const column = (tasksInTargetColumn || []).filter((t) => t.id !== id)
    column.splice(newPosition, 0, { id, status: newStatus, position: 0 } as any)
    column.forEach((t, idx) => {
      updates.push({ id: t.id, status: newStatus, position: idx })
    })
  } else {
    // Reorder dans les 2 colonnes
    const sourceCol = (tasksInTargetColumn || []).filter((t) => t.status === oldStatus && t.id !== id)
    sourceCol.forEach((t, idx) => updates.push({ id: t.id, status: oldStatus, position: idx }))

    const targetCol = (tasksInTargetColumn || []).filter((t) => t.status === newStatus)
    targetCol.splice(newPosition, 0, { id, status: newStatus, position: 0 } as any)
    targetCol.forEach((t, idx) => updates.push({ id: t.id, status: newStatus, position: idx }))
  }

  // Si on bascule en terminée → completed_at
  // Si on revient d'une terminée → reset
  const extra: Record<string, unknown> = {}
  if (newStatus === 'terminee' && oldStatus !== 'terminee') {
    extra.completed_at = new Date().toISOString()
  } else if (newStatus !== 'terminee' && oldStatus === 'terminee') {
    extra.completed_at = null
  }

  // Batch updates : on update tout d'un coup
  // Note : Supabase ne supporte pas un vrai bulk update — on fait des Promise.all
  await Promise.all(
    updates.map((u) =>
      supabase
        .from('crm_taches')
        .update({
          status: u.status,
          position: u.position,
          ...(u.id === id ? extra : {}),
        })
        .eq('id', u.id)
        .eq('organization_id', session.organization.id),
    ),
  )

  await logAudit({
    action: 'move',
    entity_type: 'crm_tache',
    entity_id: id,
    details: { from: oldStatus, to: newStatus, position: newPosition },
  })
  revalidatePath('/dashboard/taches')
  return { success: true }
}

export async function deleteTacheAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('crm_taches')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la suppression' }

  await logAudit({ action: 'delete', entity_type: 'crm_tache', entity_id: id })
  revalidatePath('/dashboard/taches')
  return { success: true }
}

export async function assignTacheToMeAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('crm_taches')
    .update({ assignee_id: session.user.id })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/taches')
  return { success: true }
}

export async function addCommentAction(tacheId: string, contenu: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const trimmed = contenu.trim()
  if (!trimmed) return { success: false, error: 'Commentaire vide' }

  // Vérifier que la tâche est de l'org
  const { data: tache } = await supabase
    .from('crm_taches')
    .select('id, titre, assignee_id, created_by')
    .eq('id', tacheId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!tache) return { success: false, error: 'Tâche introuvable' }

  const { error } = await supabase.from('crm_taches_commentaires').insert({
    tache_id: tacheId,
    author_id: session.user.id,
    contenu: trimmed,
  })

  if (error) return { success: false, error: 'Erreur' }

  // Notifier toutes les personnes impliquées (assignee + créateur + commentateurs précédents)
  // sauf l'auteur du commentaire
  const { data: prevComments } = await supabase
    .from('crm_taches_commentaires')
    .select('author_id')
    .eq('tache_id', tacheId)

  const recipients = new Set<string>()
  if (tache.assignee_id) recipients.add(tache.assignee_id)
  if (tache.created_by) recipients.add(tache.created_by)
  for (const c of prevComments || []) {
    if (c.author_id) recipients.add(c.author_id)
  }
  recipients.delete(session.user.id)

  if (recipients.size > 0) {
    const actorName = await getActorName(supabase, session.user.id)
    const { createNotifications } = await import('@/lib/email')
    await createNotifications(
      Array.from(recipients).map((userId) => ({
        organizationId: session.organization.id,
        userId,
        titre: 'Nouveau commentaire',
        message: `${actorName} a commenté « ${tache.titre} » : ${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}`,
        type: 'info',
        lienUrl: '/dashboard/taches',
        lienLabel: 'Voir la discussion',
        entityType: 'crm_tache',
        entityId: tacheId,
      })),
    )
  }

  revalidatePath('/dashboard/taches')
  return { success: true }
}
