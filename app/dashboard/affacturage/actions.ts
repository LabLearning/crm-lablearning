'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string }

const round2 = (n: number) => Math.round(n * 100) / 100

// ════════════════════════════════════════════════════════════
// CRUD AFFACTUREURS
// ════════════════════════════════════════════════════════════

export async function createAffactureurAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const raison_sociale = (formData.get('raison_sociale') as string || '').trim()
  if (!raison_sociale) return { success: false, error: 'Raison sociale requise' }

  const payload = {
    organization_id: session.organization.id,
    raison_sociale,
    siret: (formData.get('siret') as string || null) || null,
    contact_nom: (formData.get('contact_nom') as string || null) || null,
    contact_email: (formData.get('contact_email') as string || null) || null,
    contact_telephone: (formData.get('contact_telephone') as string || null) || null,
    taux_commission_default: parseFloat((formData.get('taux_commission_default') as string) || '1.5'),
    taux_retenue_default: parseFloat((formData.get('taux_retenue_default') as string) || '10'),
    delai_avance_jours: parseInt((formData.get('delai_avance_jours') as string) || '2'),
    plafond_encours: formData.get('plafond_encours') ? parseFloat(formData.get('plafond_encours') as string) : null,
    notes: (formData.get('notes') as string || null) || null,
    is_active: true,
  }

  const { data, error } = await supabase.from('affactureurs').insert(payload).select().single()
  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'create', entity_type: 'affactureur', entity_id: data.id })
  revalidatePath('/dashboard/affacturage')
  return { success: true, data }
}

export async function updateAffactureurAction(id: string, formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updates: Record<string, unknown> = {}
  for (const key of [
    'raison_sociale', 'siret', 'contact_nom', 'contact_email', 'contact_telephone', 'notes',
  ]) {
    if (formData.has(key)) updates[key] = (formData.get(key) as string || null) || null
  }
  for (const key of ['taux_commission_default', 'taux_retenue_default', 'plafond_encours']) {
    if (formData.has(key)) {
      const v = formData.get(key) as string
      updates[key] = v ? parseFloat(v) : null
    }
  }
  if (formData.has('delai_avance_jours')) {
    const v = formData.get('delai_avance_jours') as string
    updates.delai_avance_jours = v ? parseInt(v) : null
  }
  if (formData.has('is_active')) updates.is_active = formData.get('is_active') === 'true'

  const { error } = await supabase
    .from('affactureurs')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'update', entity_type: 'affactureur', entity_id: id })
  revalidatePath('/dashboard/affacturage')
  return { success: true }
}

export async function deleteAffactureurAction(id: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Check no active cession uses it
  const { count } = await supabase
    .from('cessions_creances')
    .select('id', { count: 'exact', head: true })
    .eq('affactureur_id', id)
    .not('status', 'in', '("annulee","soldee","impayee")')

  if ((count || 0) > 0) {
    return { success: false, error: 'Impossible : des cessions actives utilisent ce factor. Archivez-le plutôt.' }
  }

  const { error } = await supabase
    .from('affactureurs')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/affacturage')
  return { success: true }
}

// ════════════════════════════════════════════════════════════
// CESSIONS DE CRÉANCES
// ════════════════════════════════════════════════════════════

/**
 * Cède une facture à l'affacturage.
 * Calcule auto commission, retenue, avance.
 */
export async function cederFactureAction(factureId: string, formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const affactureur_id = formData.get('affactureur_id') as string
  if (!affactureur_id) return { success: false, error: 'Affactureur requis' }

  // Vérifier facture + pas déjà cédée activement
  const { data: facture } = await supabase
    .from('factures')
    .select('id, numero, montant_ttc, status, affacturage_status')
    .eq('id', factureId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!facture) return { success: false, error: 'Facture introuvable' }
  if (facture.status === 'brouillon') return { success: false, error: 'Émettez la facture avant de la céder' }
  if (facture.status === 'annulee') return { success: false, error: 'Facture annulée' }

  const { data: existing } = await supabase
    .from('cessions_creances')
    .select('id, status')
    .eq('facture_id', factureId)
    .not('status', 'in', '("annulee","soldee","impayee")')
    .maybeSingle()
  if (existing) return { success: false, error: 'Cette facture est déjà cédée' }

  // Affactureur + défauts
  const { data: factor } = await supabase
    .from('affactureurs')
    .select('id, taux_commission_default, taux_retenue_default')
    .eq('id', affactureur_id)
    .eq('organization_id', session.organization.id)
    .single()
  if (!factor) return { success: false, error: 'Affactureur introuvable' }

  const montant_cede = formData.get('montant_cede')
    ? parseFloat(formData.get('montant_cede') as string)
    : Number(facture.montant_ttc)
  const taux_commission = formData.get('taux_commission')
    ? parseFloat(formData.get('taux_commission') as string)
    : Number(factor.taux_commission_default || 1.5)
  const taux_retenue = formData.get('taux_retenue')
    ? parseFloat(formData.get('taux_retenue') as string)
    : Number(factor.taux_retenue_default || 0)

  const montant_commission = round2(montant_cede * (taux_commission / 100))
  const montant_retenue = round2(montant_cede * (taux_retenue / 100))
  const montant_avance = round2(montant_cede - montant_commission - montant_retenue)

  const reference_factor = (formData.get('reference_factor') as string || null) || null
  const date_cession = (formData.get('date_cession') as string) || new Date().toISOString().split('T')[0]
  const notes = (formData.get('notes') as string || null) || null

  const { data: cession, error } = await supabase
    .from('cessions_creances')
    .insert({
      organization_id: session.organization.id,
      facture_id: factureId,
      affactureur_id,
      reference_factor,
      montant_cede,
      taux_commission,
      montant_commission,
      taux_retenue,
      montant_retenue,
      montant_avance,
      date_cession,
      notes,
      status: 'en_attente_avance',
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Mettre à jour le flag facture
  await supabase
    .from('factures')
    .update({ affacturage_status: 'cedee' })
    .eq('id', factureId)

  await logAudit({
    action: 'cession',
    entity_type: 'facture',
    entity_id: factureId,
    details: { affactureur_id, montant_cede, montant_avance },
  })
  revalidatePath('/dashboard/affacturage')
  revalidatePath('/dashboard/factures')
  revalidatePath(`/dashboard/factures/${factureId}`)
  return { success: true, data: cession }
}

/** Le factor a versé l'avance à Lab Learning. */
export async function marquerAvanceRecueAction(
  cessionId: string,
  dateAvance: string,
): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: cession } = await supabase
    .from('cessions_creances')
    .select('id, facture_id, status')
    .eq('id', cessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!cession) return { success: false, error: 'Cession introuvable' }
  if (cession.status !== 'en_attente_avance') {
    return { success: false, error: 'Cette cession n\'est pas en attente d\'avance' }
  }

  const { error } = await supabase
    .from('cessions_creances')
    .update({
      status: 'avancee',
      date_avance: dateAvance || new Date().toISOString().split('T')[0],
    })
    .eq('id', cessionId)

  if (error) return { success: false, error: error.message }

  await supabase
    .from('factures')
    .update({ affacturage_status: 'avancee' })
    .eq('id', cession.facture_id)

  await logAudit({ action: 'avance_recue', entity_type: 'cession', entity_id: cessionId })
  revalidatePath('/dashboard/affacturage')
  revalidatePath('/dashboard/factures')
  return { success: true }
}

/** Soldée : l'OPCO a payé le factor. */
export async function marquerSoldeeAction(cessionId: string, dateSolde?: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: cession } = await supabase
    .from('cessions_creances')
    .select('id, facture_id, status')
    .eq('id', cessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!cession) return { success: false, error: 'Cession introuvable' }

  const { error } = await supabase
    .from('cessions_creances')
    .update({
      status: 'soldee',
      date_soldee: dateSolde || new Date().toISOString().split('T')[0],
    })
    .eq('id', cessionId)

  if (error) return { success: false, error: error.message }

  await supabase
    .from('factures')
    .update({ affacturage_status: 'soldee' })
    .eq('id', cession.facture_id)

  await logAudit({ action: 'soldee', entity_type: 'cession', entity_id: cessionId })
  revalidatePath('/dashboard/affacturage')
  revalidatePath('/dashboard/factures')
  return { success: true }
}

export async function marquerImpayeeAction(cessionId: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: cession } = await supabase
    .from('cessions_creances')
    .select('id, facture_id')
    .eq('id', cessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!cession) return { success: false, error: 'Cession introuvable' }

  const { error } = await supabase
    .from('cessions_creances')
    .update({ status: 'impayee' })
    .eq('id', cessionId)
  if (error) return { success: false, error: error.message }

  await supabase
    .from('factures')
    .update({ affacturage_status: 'impayee' })
    .eq('id', cession.facture_id)

  revalidatePath('/dashboard/affacturage')
  return { success: true }
}

/** Annule une cession (avant que le factor n'avance). */
export async function annulerCessionAction(cessionId: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: cession } = await supabase
    .from('cessions_creances')
    .select('id, facture_id, status')
    .eq('id', cessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!cession) return { success: false, error: 'Cession introuvable' }
  if (cession.status === 'avancee' || cession.status === 'soldee') {
    return { success: false, error: 'Impossible d\'annuler une cession déjà avancée' }
  }

  const { error } = await supabase
    .from('cessions_creances')
    .update({ status: 'annulee' })
    .eq('id', cessionId)
  if (error) return { success: false, error: error.message }

  // Reset flag facture seulement s'il n'y a plus de cession active
  await supabase
    .from('factures')
    .update({ affacturage_status: null })
    .eq('id', cession.facture_id)

  revalidatePath('/dashboard/affacturage')
  revalidatePath('/dashboard/factures')
  return { success: true }
}
