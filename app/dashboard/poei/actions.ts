'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

function canManage(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial'].includes(role)
}

function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string) || ''
  return v.trim() || null
}
function num(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string) || ''
  if (!v.trim()) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export async function createPoeiAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const candidat_nom = str(formData, 'candidat_nom')
  if (!candidat_nom) return { success: false, errors: { candidat_nom: ['Nom du candidat requis'] } }

  const supabase = await createServiceRoleClient()

  const { count } = await supabase
    .from('poei')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  const numero = `POEI-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const dureeHeures = num(formData, 'duree_heures')
  const montantHoraire = num(formData, 'montant_horaire')
  const montantTotal = (dureeHeures != null && montantHoraire != null)
    ? Math.round(dureeHeures * montantHoraire * 100) / 100
    : num(formData, 'montant_total')

  const { data, error } = await supabase
    .from('poei')
    .insert({
      organization_id: session.organization.id,
      numero,
      candidat_civilite: str(formData, 'candidat_civilite'),
      candidat_nom,
      candidat_prenom: str(formData, 'candidat_prenom'),
      candidat_email: str(formData, 'candidat_email'),
      candidat_telephone: str(formData, 'candidat_telephone'),
      candidat_identifiant_ft: str(formData, 'candidat_identifiant_ft'),
      client_id: str(formData, 'client_id'),
      poste_vise: str(formData, 'poste_vise'),
      type_contrat: str(formData, 'type_contrat'),
      date_embauche_prevue: str(formData, 'date_embauche_prevue'),
      tuteur_nom: str(formData, 'tuteur_nom'),
      formation_id: str(formData, 'formation_id'),
      session_id: str(formData, 'session_id'),
      duree_heures: dureeHeures,
      date_debut: str(formData, 'date_debut'),
      date_fin: str(formData, 'date_fin'),
      montant_horaire: montantHoraire,
      montant_total: montantTotal,
      numero_dossier_ft: str(formData, 'numero_dossier_ft'),
      statut: str(formData, 'statut') || 'prospect',
      notes: str(formData, 'notes'),
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'poei', entity_id: data.id })
  revalidatePath('/dashboard/poei')
  return { success: true, data }
}

export async function updatePoeiStatutAction(id: string, statut: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()

  // Dates auto selon le statut
  const updateData: Record<string, unknown> = { statut }
  if (statut === 'depose') updateData.date_depot_ft = new Date().toISOString().slice(0, 10)
  if (statut === 'accorde') updateData.date_accord_ft = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('poei')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'update_status', entity_type: 'poei', entity_id: id, details: { statut } })
  revalidatePath('/dashboard/poei')
  revalidatePath(`/dashboard/poei/${id}`)
  return { success: true }
}

export async function updatePoeiAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()

  const dureeHeures = num(formData, 'duree_heures')
  const montantHoraire = num(formData, 'montant_horaire')
  const montantTotal = (dureeHeures != null && montantHoraire != null)
    ? Math.round(dureeHeures * montantHoraire * 100) / 100
    : num(formData, 'montant_total')

  const { error } = await supabase
    .from('poei')
    .update({
      candidat_civilite: str(formData, 'candidat_civilite'),
      candidat_nom: str(formData, 'candidat_nom'),
      candidat_prenom: str(formData, 'candidat_prenom'),
      candidat_email: str(formData, 'candidat_email'),
      candidat_telephone: str(formData, 'candidat_telephone'),
      candidat_identifiant_ft: str(formData, 'candidat_identifiant_ft'),
      client_id: str(formData, 'client_id'),
      poste_vise: str(formData, 'poste_vise'),
      type_contrat: str(formData, 'type_contrat'),
      date_embauche_prevue: str(formData, 'date_embauche_prevue'),
      tuteur_nom: str(formData, 'tuteur_nom'),
      formation_id: str(formData, 'formation_id'),
      session_id: str(formData, 'session_id'),
      duree_heures: dureeHeures,
      date_debut: str(formData, 'date_debut'),
      date_fin: str(formData, 'date_fin'),
      montant_horaire: montantHoraire,
      montant_total: montantTotal,
      numero_dossier_ft: str(formData, 'numero_dossier_ft'),
      notes: str(formData, 'notes'),
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'poei', entity_id: id })
  revalidatePath(`/dashboard/poei/${id}`)
  revalidatePath('/dashboard/poei')
  return { success: true }
}

export async function deletePoeiAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('poei')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'delete', entity_type: 'poei', entity_id: id })
  revalidatePath('/dashboard/poei')
  return { success: true }
}
