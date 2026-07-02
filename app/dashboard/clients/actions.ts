'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClientSchema } from '@/lib/validations/crm'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createClientAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()

  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return {
      success: false,
      errors: fieldErrors,
      error: formErrors.length > 0 ? formErrors[0] : undefined,
    }
  }

  const supabase = await createServiceRoleClient()

  const insertData = {
    organization_id: session.organization.id,
    type: parsed.data.type,
    raison_sociale: parsed.data.raison_sociale || null,
    siret: parsed.data.siret || null,
    code_naf: parsed.data.code_naf || null,
    secteur_activite: parsed.data.secteur_activite || null,
    taille_entreprise: parsed.data.taille_entreprise || null,
    civilite: parsed.data.civilite || null,
    nom: parsed.data.nom || null,
    prenom: parsed.data.prenom || null,
    adresse: parsed.data.adresse || null,
    code_postal: parsed.data.code_postal || null,
    ville: parsed.data.ville || null,
    telephone: parsed.data.telephone || null,
    whatsapp: parsed.data.whatsapp || null,
    whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
    email: parsed.data.email || null,
    site_web: parsed.data.site_web || null,
    financeur_type: parsed.data.financeur_type || null,
    numero_opco: parsed.data.numero_opco || null,
    opco_id: parsed.data.opco_id || null,
    opco_compte_status: parsed.data.opco_compte_status || 'aucun',
    code_idcc: parsed.data.code_idcc || null,
    convention_collective: parsed.data.convention_collective || null,
    sigle: parsed.data.sigle || null,
    forme_juridique: parsed.data.forme_juridique || null,
    date_creation_entreprise: parsed.data.date_creation_entreprise || null,
    effectif_libelle: parsed.data.effectif_libelle || null,
    tva_intra: parsed.data.tva_intra || null,
    est_qualiopi: parsed.data.est_qualiopi === true,
    est_organisme_formation: parsed.data.est_organisme_formation === true,
    notes: parsed.data.notes || null,
    assigned_to: parsed.data.assigned_to || session.user.id,
    created_by: session.user.id,
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[Create Client]', error)
    return { success: false, error: 'Erreur lors de la création du client' }
  }

  // Si on a un dirigeant pré-rempli depuis l'autocomplete data.gouv,
  // créer automatiquement un contact principal lié à ce client
  if (parsed.data.dirigeant_nom && parsed.data.dirigeant_prenom) {
    await supabase.from('contacts').insert({
      organization_id: session.organization.id,
      client_id: data.id,
      prenom: parsed.data.dirigeant_prenom,
      nom: parsed.data.dirigeant_nom,
      poste: parsed.data.dirigeant_qualite || null,
      est_principal: true,
      created_by: session.user.id,
    })
  }

  await logAudit({ action: 'create', entity_type: 'client', entity_id: data.id })
  revalidatePath('/dashboard/clients')
  return { success: true, data }
}

export async function updateClientAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const formErrors = parsed.error.flatten().formErrors
    return { success: false, errors: fieldErrors, error: formErrors[0] }
  }

  const updateData = {
    type: parsed.data.type,
    raison_sociale: parsed.data.raison_sociale || null,
    siret: parsed.data.siret || null,
    code_naf: parsed.data.code_naf || null,
    secteur_activite: parsed.data.secteur_activite || null,
    taille_entreprise: parsed.data.taille_entreprise || null,
    civilite: parsed.data.civilite || null,
    nom: parsed.data.nom || null,
    prenom: parsed.data.prenom || null,
    adresse: parsed.data.adresse || null,
    code_postal: parsed.data.code_postal || null,
    ville: parsed.data.ville || null,
    telephone: parsed.data.telephone || null,
    whatsapp: parsed.data.whatsapp || null,
    whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
    email: parsed.data.email || null,
    site_web: parsed.data.site_web || null,
    financeur_type: parsed.data.financeur_type || null,
    numero_opco: parsed.data.numero_opco || null,
    opco_id: parsed.data.opco_id || null,
    opco_compte_status: parsed.data.opco_compte_status || 'aucun',
    code_idcc: parsed.data.code_idcc || null,
    convention_collective: parsed.data.convention_collective || null,
    sigle: parsed.data.sigle || null,
    forme_juridique: parsed.data.forme_juridique || null,
    date_creation_entreprise: parsed.data.date_creation_entreprise || null,
    effectif_libelle: parsed.data.effectif_libelle || null,
    tva_intra: parsed.data.tva_intra || null,
    est_qualiopi: parsed.data.est_qualiopi === true,
    est_organisme_formation: parsed.data.est_organisme_formation === true,
    notes: parsed.data.notes || null,
  } as Record<string, unknown>

  // N'écrase l'assignation que si le champ est présent dans le formulaire.
  // (Les commerciaux ne voient pas ce champ → il est absent → assignation préservée.
  //  Les managers l'envoient toujours, vide = désassigner.)
  if (parsed.data.assigned_to !== undefined) {
    updateData.assigned_to = parsed.data.assigned_to || null
  }

  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de la mise à jour' }
  }

  await logAudit({ action: 'update', entity_type: 'client', entity_id: id })
  revalidatePath('/dashboard/clients')
  return { success: true }
}

export async function updateClientNotesAction(id: string, notes: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('clients')
    .update({ notes: notes || null })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de l\'enregistrement' }
  }

  await logAudit({ action: 'update', entity_type: 'client', entity_id: id })
  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${id}`)
  return { success: true }
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Impossible de supprimer ce client (données liées existantes)' }
  }

  await logAudit({ action: 'delete', entity_type: 'client', entity_id: id })
  revalidatePath('/dashboard/clients')
  return { success: true }
}
