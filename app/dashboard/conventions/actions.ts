'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createConventionSchema } from '@/lib/validations/dossier'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createConventionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createConventionSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('conventions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  const numero = `CONV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
  const montant_ttc = parsed.data.montant_ht * (1 + parsed.data.taux_tva / 100)

  const { data, error } = await supabase
    .from('conventions')
    .insert({
      organization_id: session.organization.id,
      numero,
      type: parsed.data.type,
      client_id: parsed.data.client_id,
      formation_id: parsed.data.formation_id,
      session_id: parsed.data.session_id || null,
      devis_id: parsed.data.devis_id || null,
      dossier_id: parsed.data.dossier_id || null,
      objet: parsed.data.objet || null,
      nombre_stagiaires: parsed.data.nombre_stagiaires,
      duree_heures: parsed.data.duree_heures || null,
      lieu: parsed.data.lieu || null,
      dates_formation: parsed.data.dates_formation || null,
      montant_ht: parsed.data.montant_ht,
      taux_tva: parsed.data.taux_tva,
      montant_ttc: Math.round(montant_ttc * 100) / 100,
      financeur_type: parsed.data.financeur_type || null,
      financeur_nom: parsed.data.financeur_nom || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'convention', entity_id: data.id })
  revalidatePath('/dashboard/conventions')
  return { success: true, data }
}

export async function updateConventionStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updateData: Record<string, unknown> = { status }
  if (status === 'envoyee') updateData.sent_at = new Date().toISOString()
  if (status === 'signee_client') updateData.signature_client_date = new Date().toISOString()
  if (status === 'signee_complete') updateData.signature_of_date = new Date().toISOString()

  const { error } = await supabase
    .from('conventions')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'update_status', entity_type: 'convention', entity_id: id, details: { status } })
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

export async function updateConventionDetailsAction(
  id: string,
  details: { session_id?: string | null; financeur_type?: string | null; financeur_nom?: string | null },
): Promise<ActionResult> {
  const session = await getSession()

  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const updateData: Record<string, unknown> = {}
  if ('session_id' in details) updateData.session_id = details.session_id || null
  if ('financeur_type' in details) updateData.financeur_type = details.financeur_type || null
  if ('financeur_nom' in details) updateData.financeur_nom = details.financeur_nom || null

  const { error } = await supabase
    .from('conventions')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'convention', entity_id: id, details })
  revalidatePath(`/dashboard/conventions/${id}`)
  revalidatePath('/dashboard/conventions')
  return { success: true }
}

export async function deleteConventionAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('conventions')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'delete', entity_type: 'convention', entity_id: id })
  revalidatePath('/dashboard/conventions')
  return { success: true }
}
