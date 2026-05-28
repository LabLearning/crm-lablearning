'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createFormateurSchema } from '@/lib/validations/formation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

function splitComma(text: string | undefined): string[] {
  if (!text) return []
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}

export async function createFormateurAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFormateurSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('formateurs')
    .insert({
      organization_id: session.organization.id,
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      whatsapp: parsed.data.whatsapp || null,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
      qualifications: parsed.data.qualifications || null,
      domaines_expertise: splitComma(parsed.data.domaines_expertise),
      certifications: splitComma(parsed.data.certifications),
      type_contrat: parsed.data.type_contrat,
      siret: parsed.data.siret || null,
      tarif_journalier: parsed.data.tarif_journalier || null,
      tarif_horaire: parsed.data.tarif_horaire || null,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'formateur', entity_id: data.id })
  revalidatePath('/dashboard/formateurs')
  return { success: true, data }
}

export async function updateFormateurAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFormateurSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formateurs')
    .update({
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      whatsapp: parsed.data.whatsapp || null,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
      qualifications: parsed.data.qualifications || null,
      domaines_expertise: splitComma(parsed.data.domaines_expertise),
      certifications: splitComma(parsed.data.certifications),
      type_contrat: parsed.data.type_contrat,
      siret: parsed.data.siret || null,
      tarif_journalier: parsed.data.tarif_journalier || null,
      tarif_horaire: parsed.data.tarif_horaire || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'formateur', entity_id: id })
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function updateHabilitationAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const dateHabilitation = formData.get('date_derniere_habilitation') as string
  const prochaineMaj = formData.get('prochaine_mise_a_jour') as string
  const notes = formData.get('habilitation_notes') as string

  // Fetch current history
  const { data: current } = await supabase
    .from('formateurs')
    .select('historique_habilitations')
    .eq('id', id)
    .single()

  const history = [...(current?.historique_habilitations || []), {
    date: dateHabilitation,
    notes: notes || '',
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  }]

  const { error } = await supabase
    .from('formateurs')
    .update({
      date_derniere_habilitation: dateHabilitation || null,
      prochaine_mise_a_jour: prochaineMaj || null,
      historique_habilitations: history,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'update_habilitation', entity_type: 'formateur', entity_id: id })
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function toggleFormateurAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formateurs')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function deleteFormateurAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formateurs')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (sessions liées)' }

  await logAudit({ action: 'delete', entity_type: 'formateur', entity_id: id })
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}
