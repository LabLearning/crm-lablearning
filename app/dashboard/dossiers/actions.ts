'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createDossierSchema } from '@/lib/validations/dossier'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { recalcDossierCommission } from '@/lib/commission'
import type { ActionResult } from '@/lib/types'

export async function createDossierAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createDossierSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('dossiers_formation')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  const numero = `DOS-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data, error } = await supabase
    .from('dossiers_formation')
    .insert({
      organization_id: session.organization.id,
      numero,
      client_id: parsed.data.client_id,
      contact_id: parsed.data.contact_id || null,
      formation_id: parsed.data.formation_id || null,
      session_id: parsed.data.session_id || null,
      financeur_type: parsed.data.financeur_type || null,
      financeur_nom: parsed.data.financeur_nom || null,
      numero_prise_en_charge: parsed.data.numero_prise_en_charge || null,
      montant_prise_en_charge: parsed.data.montant_prise_en_charge || null,
      notes: parsed.data.notes || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  // Add timeline entry
  await supabase.from('dossier_timeline').insert({
    dossier_id: data.id,
    action: 'dossier_cree',
    description: 'Dossier de formation créé',
    user_id: session.user.id,
  })

  // Calcul commission franchise (si l'établissement est rattaché à une franchise)
  await recalcDossierCommission(supabase, data.id, session.organization.id)

  // Notifier la franchise si l'établissement y est rattaché
  const { data: cl } = await supabase
    .from('clients')
    .select('franchise_id, raison_sociale')
    .eq('id', parsed.data.client_id)
    .single()
  if (cl?.franchise_id) {
    const { notifyFranchiseUsers } = await import('@/lib/franchise-notify')
    await notifyFranchiseUsers(supabase, cl.franchise_id, session.organization.id, {
      titre: 'Nouveau dossier de formation',
      message: `Un dossier de formation a été ouvert pour ${cl.raison_sociale}.`,
      type: 'info',
      lienUrl: '/franchise/etablissements',
      lienLabel: 'Voir mes établissements',
      entityType: 'dossier_formation',
      entityId: data.id,
      email: {
        subject: `Nouveau dossier — ${cl.raison_sociale}`,
        docTitle: 'Nouveau dossier de formation',
        intro: `Un dossier de formation vient d'être ouvert pour l'établissement ${cl.raison_sociale} de votre réseau.`,
        metadata: [
          ['Établissement', cl.raison_sociale],
          ['Date d\'ouverture', new Date().toLocaleDateString('fr-FR')],
        ],
        ctaLabel: 'Voir le dossier',
      },
    })
  }

  await logAudit({ action: 'create', entity_type: 'dossier', entity_id: data.id })
  revalidatePath('/dashboard/dossiers')
  return { success: true, data }
}

/**
 * Met à jour les montants financiers d'un dossier (PEC, total HT/TTC)
 * et recalcule la commission franchise.
 */
export async function updateDossierFinancialsAction(
  dossierId: string,
  data: { montant_prise_en_charge?: number; montant_total_ht?: number; montant_total_ttc?: number },
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updates: Record<string, unknown> = {}
  if (data.montant_prise_en_charge != null) updates.montant_prise_en_charge = data.montant_prise_en_charge
  if (data.montant_total_ht != null) updates.montant_total_ht = data.montant_total_ht
  if (data.montant_total_ttc != null) updates.montant_total_ttc = data.montant_total_ttc

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('dossiers_formation')
      .update(updates)
      .eq('id', dossierId)
      .eq('organization_id', session.organization.id)
    if (error) return { success: false, error: error.message }
  }

  await recalcDossierCommission(supabase, dossierId, session.organization.id)

  revalidatePath('/dashboard/dossiers')
  revalidatePath(`/dashboard/dossiers/${dossierId}`)
  revalidatePath('/dashboard/franchises')
  return { success: true }
}

export async function updateDossierStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const dateField: Record<string, string> = {
    devis_envoye: 'date_devis',
    convention_signee: 'date_convention',
    en_cours: 'date_debut_formation',
    realise: 'date_fin_formation',
    facture: 'date_facturation',
    cloture: 'date_cloture',
  }

  const updateData: Record<string, unknown> = { status }
  if (dateField[status]) {
    updateData[dateField[status]] = new Date().toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('dossiers_formation')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  // Timeline
  const actionLabels: Record<string, string> = {
    devis_envoye: 'Devis envoyé',
    convention_signee: 'Convention signée',
    en_cours: 'Formation démarrée',
    realise: 'Formation réalisée',
    facture: 'Facture émise',
    cloture: 'Dossier clôturé',
  }

  await supabase.from('dossier_timeline').insert({
    dossier_id: id,
    action: `status_${status}`,
    description: actionLabels[status] || `Statut: ${status}`,
    user_id: session.user.id,
  })

  await logAudit({ action: 'update_status', entity_type: 'dossier', entity_id: id, details: { status } })
  revalidatePath('/dashboard/dossiers')
  return { success: true }
}

export async function toggleChecklistItemAction(itemId: string, completed: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('dossier_checklist')
    .update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? session.user.id : null,
    })
    .eq('id', itemId)

  if (error) return { success: false, error: 'Erreur' }

  revalidatePath('/dashboard/dossiers')
  return { success: true }
}

export async function deleteDossierAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('dossiers_formation')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la suppression' }

  await logAudit({ action: 'delete', entity_type: 'dossier', entity_id: id })
  revalidatePath('/dashboard/dossiers')
  return { success: true }
}
