'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type OpcoWorkflowStatus =
  | 'a_constituer' | 'pret_a_envoyer' | 'envoye_opco' | 'en_attente_opco'
  | 'valide_opco' | 'refuse_opco' | 'mise_en_paiement' | 'paye'

export const OPCO_WORKFLOW_LABELS: Record<OpcoWorkflowStatus, string> = {
  a_constituer: 'À constituer',
  pret_a_envoyer: 'Prêt à envoyer',
  envoye_opco: 'Envoyé à l\'OPCO',
  en_attente_opco: 'En attente OPCO',
  valide_opco: 'Validé par OPCO',
  refuse_opco: 'Refusé par OPCO',
  mise_en_paiement: 'En mise en paiement',
  paye: 'Payé',
}

export const OPCO_WORKFLOW_COLORS: Record<OpcoWorkflowStatus, string> = {
  a_constituer: 'bg-surface-100 text-surface-700',
  pret_a_envoyer: 'bg-amber-100 text-amber-700',
  envoye_opco: 'bg-brand-100 text-brand-700',
  en_attente_opco: 'bg-amber-100 text-amber-700',
  valide_opco: 'bg-emerald-100 text-emerald-700',
  refuse_opco: 'bg-red-100 text-red-700',
  mise_en_paiement: 'bg-purple-100 text-purple-700',
  paye: 'bg-emerald-100 text-emerald-800 font-semibold',
}

export async function updateDossierOpcoStatusAction(
  dossierId: string,
  newStatus: OpcoWorkflowStatus,
  data?: { numero_dossier?: string; motif_refus?: string }
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Validation : pour passer en mise_en_paiement, l'accord doit être uploadé
  if (newStatus === 'mise_en_paiement') {
    const { data: dossier } = await supabase
      .from('dossiers_formation')
      .select('accord_prise_en_charge_url')
      .eq('id', dossierId)
      .eq('organization_id', session.organization.id)
      .single()
    if (!dossier?.accord_prise_en_charge_url) {
      return { success: false, error: 'Vous devez uploader l\'accord de prise en charge OPCO avant la mise en paiement.' }
    }
  }

  const updates: Record<string, unknown> = { opco_workflow_status: newStatus }
  const now = new Date().toISOString()
  if (newStatus === 'envoye_opco') updates.opco_envoye_at = now
  if (newStatus === 'valide_opco') {
    updates.opco_valide_at = now
    if (data?.numero_dossier) updates.opco_numero_dossier = data.numero_dossier
  }
  if (newStatus === 'refuse_opco') {
    updates.opco_refuse_at = now
    if (data?.motif_refus) updates.opco_motif_refus = data.motif_refus
  }
  if (newStatus === 'mise_en_paiement') updates.mise_en_paiement_at = now
  if (newStatus === 'paye') updates.paye_at = now

  const { error } = await supabase
    .from('dossiers_formation')
    .update(updates)
    .eq('id', dossierId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  // ── Auto-création facture client à la mise en paiement ──
  if (newStatus === 'mise_en_paiement') {
    await maybeCreateInvoiceFromDossier(supabase, dossierId, session.organization.id, session.user.id)
  }

  await logAudit({
    action: `dossier_opco_${newStatus}`,
    entity_type: 'dossier_formation',
    entity_id: dossierId,
    details: data,
  })
  revalidatePath('/dashboard/dossiers')
  return { success: true }
}

/** Met à jour le numéro de dossier OPCO à n'importe quel moment du workflow */
export async function updateOpcoNumeroAction(dossierId: string, numero: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('dossiers_formation')
    .update({ opco_numero_dossier: numero.trim() || null })
    .eq('id', dossierId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'update_opco_numero', entity_type: 'dossier_formation', entity_id: dossierId, details: { numero } })
  revalidatePath(`/dashboard/dossiers/${dossierId}`)
  return { success: true }
}

/** Crée auto une facture client (status brouillon) liée au dossier OPCO à la mise en paiement */
async function maybeCreateInvoiceFromDossier(supabase: any, dossierId: string, organizationId: string, userId: string) {
  // Vérifier qu'il n'y a pas déjà une facture pour ce dossier
  const { data: existing } = await supabase
    .from('factures').select('id').eq('dossier_id', dossierId).limit(1).maybeSingle()
  if (existing) return

  // Charger le dossier avec ses relations
  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select('id, client_id, session_id, formation_id, montant_total_ht, montant_total_ttc')
    .eq('id', dossierId).single()
  if (!dossier?.client_id) return

  // Numérotation facture : F-YYYY-NNN
  const { count } = await supabase
    .from('factures').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId)
  const numero = `F-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const ht = Number(dossier.montant_total_ht || 0)
  const ttc = Number(dossier.montant_total_ttc || 0)
  const tva = ttc - ht
  const echeance = new Date(); echeance.setDate(echeance.getDate() + 30)

  await supabase.from('factures').insert({
    organization_id: organizationId,
    numero,
    type: 'facture',
    client_id: dossier.client_id,
    dossier_id: dossierId,
    session_id: dossier.session_id,
    status: 'brouillon',
    date_emission: new Date().toISOString().split('T')[0],
    date_echeance: echeance.toISOString().split('T')[0],
    montant_ht: ht,
    montant_tva: tva,
    taux_tva: ht > 0 ? Number((tva / ht * 100).toFixed(2)) : 20,
    montant_ttc: ttc,
    montant_restant: ttc,
    created_by: userId,
  })
}

/** Quand session terminée + tout validé → bascule auto vers mise_en_paiement */
export async function maybeMoveToMiseEnPaiement(supabase: any, sessionId: string, organizationId: string) {
  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select('id, opco_workflow_status')
    .eq('session_id', sessionId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!dossier) return
  if (dossier.opco_workflow_status !== 'valide_opco') return

  await supabase
    .from('dossiers_formation')
    .update({ opco_workflow_status: 'mise_en_paiement', mise_en_paiement_at: new Date().toISOString() })
    .eq('id', dossier.id)
}
