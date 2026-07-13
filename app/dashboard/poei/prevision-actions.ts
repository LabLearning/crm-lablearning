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

function previsionPayload(fd: FormData) {
  const nb = str(fd, 'nb_candidats_prevus')
  return {
    entreprise: str(fd, 'entreprise'),
    client_id: str(fd, 'client_id'),
    date_ouverture_prevue: str(fd, 'date_ouverture_prevue'),
    date_debut_formation_prevue: str(fd, 'date_debut_formation_prevue'),
    nb_candidats_prevus: nb ? parseInt(nb, 10) || null : null,
    notes: str(fd, 'notes'),
  }
}

export async function createPoeiPrevisionAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const payload = previsionPayload(formData)
  if (!payload.entreprise) return { success: false, errors: { entreprise: ['Société requise'] } }

  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('poei_previsions')
    .insert({ ...payload, organization_id: session.organization.id, created_by: session.user.id })
    .select()
    .single()
  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'poei_prevision', entity_id: data.id })
  revalidatePath('/dashboard/poei')
  return { success: true, data }
}

export async function updatePoeiPrevisionAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const payload = previsionPayload(formData)
  if (!payload.entreprise) return { success: false, errors: { entreprise: ['Société requise'] } }

  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('poei_previsions')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  revalidatePath('/dashboard/poei')
  return { success: true }
}

// Statuts modifiables inline (whitelist stricte champ → valeurs)
const STATUT_FIELDS: Record<string, string[]> = {
  statut: ['a_planifier', 'en_preparation', 'pret', 'transforme', 'abandonne'],
  recrutement_statut: ['a_lancer', 'annonce_en_ligne', 'entretiens', 'candidats_trouves'],
  compte_ft_statut: ['non_cree', 'en_cours', 'cree'],
}

export async function updatePrevisionStatutAction(id: string, field: string, value: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!STATUT_FIELDS[field]?.includes(value)) return { success: false, error: 'Valeur invalide' }

  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('poei_previsions')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }

  revalidatePath('/dashboard/poei')
  return { success: true }
}

export async function deletePoeiPrevisionAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }

  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('poei_previsions')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la suppression' }

  await logAudit({ action: 'delete', entity_type: 'poei_prevision', entity_id: id })
  revalidatePath('/dashboard/poei')
  return { success: true }
}

/**
 * Transforme une prévision en vrai projet POEI :
 * - crée le client s'il n'est pas encore lié (raison sociale = société saisie)
 * - crée le projet POEI (numéro auto, dates reprises, notes)
 * - marque la prévision "transformé" et la lie au projet
 * Retourne l'id du projet pour rediriger vers sa fiche (formation, candidats…).
 */
export async function transformerPrevisionAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id

  const supabase = await createServiceRoleClient()
  const { data: prev } = await supabase
    .from('poei_previsions')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!prev) return { success: false, error: 'Prévision introuvable' }
  if (prev.poei_id) return { success: false, error: 'Déjà transformée en projet' }

  // Client : celui lié, sinon création à partir du nom de société
  let clientId = prev.client_id
  if (!clientId) {
    const { data: client, error: cErr } = await supabase
      .from('clients')
      .insert({
        organization_id: orgId,
        type: 'entreprise',
        raison_sociale: prev.entreprise,
        created_by: session.user.id,
      })
      .select('id')
      .single()
    if (cErr || !client) return { success: false, error: 'Impossible de créer le client' }
    clientId = client.id
  }

  // Numéro de projet
  const { count } = await supabase
    .from('poei')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
  const numero = `POEI-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data: poei, error } = await supabase
    .from('poei')
    .insert({
      organization_id: orgId,
      numero,
      client_id: clientId,
      date_debut: prev.date_debut_formation_prevue,
      statut: 'montage',
      notes: prev.notes,
      created_by: session.user.id,
    })
    .select('id')
    .single()
  if (error || !poei) return { success: false, error: 'Erreur lors de la création du projet' }

  await supabase
    .from('poei_previsions')
    .update({ statut: 'transforme', poei_id: poei.id, client_id: clientId, updated_at: new Date().toISOString() })
    .eq('id', id)

  await logAudit({ action: 'transform', entity_type: 'poei_prevision', entity_id: id, details: { poei_id: poei.id } })
  revalidatePath('/dashboard/poei')
  return { success: true, data: { poeiId: poei.id } }
}
