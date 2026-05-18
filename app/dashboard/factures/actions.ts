'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createFactureSchema, createPaiementSchema } from '@/lib/validations/facture'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createFactureAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFactureSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('factures')
    .insert({
      organization_id: session.organization.id,
      numero: '', // Auto-generated
      type: parsed.data.type,
      client_id: parsed.data.client_id,
      devis_id: parsed.data.devis_id || null,
      convention_id: parsed.data.convention_id || null,
      dossier_id: parsed.data.dossier_id || null,
      session_id: parsed.data.session_id || null,
      facture_origine_id: parsed.data.facture_origine_id || null,
      objet: parsed.data.objet,
      date_echeance: parsed.data.date_echeance,
      conditions_paiement: parsed.data.conditions_paiement || 'Paiement à 30 jours',
      remise_pourcent: parsed.data.remise_pourcent,
      taux_tva: parsed.data.taux_tva,
      financeur_type: parsed.data.financeur_type || null,
      financeur_nom: parsed.data.financeur_nom || null,
      subrogation: parsed.data.subrogation || false,
      notes_internes: parsed.data.notes_internes || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('[Create Facture]', error)
    return { success: false, error: 'Erreur lors de la création' }
  }

  await logAudit({ action: 'create', entity_type: 'facture', entity_id: data.id })
  revalidatePath('/dashboard/factures')
  return { success: true, data }
}

export async function addFactureLigneAction(factureId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createServiceRoleClient()

  const designation = formData.get('designation') as string
  const quantite = parseFloat(formData.get('quantite') as string) || 1
  const prix_unitaire_ht = parseFloat(formData.get('prix_unitaire_ht') as string) || 0
  const unite = (formData.get('unite') as string) || 'forfait'

  if (!designation) return { success: false, error: 'Désignation requise' }

  const { data: lignes } = await supabase
    .from('facture_lignes')
    .select('position')
    .eq('facture_id', factureId)
    .order('position', { ascending: false })
    .limit(1)

  const { error } = await supabase.from('facture_lignes').insert({
    facture_id: factureId,
    designation,
    quantite,
    unite,
    prix_unitaire_ht,
    montant_ht: Math.round(quantite * prix_unitaire_ht * 100) / 100,
    position: (lignes?.[0]?.position ?? -1) + 1,
  })

  if (error) return { success: false, error: 'Erreur' }

  await recalculateFactureTotals(factureId)
  revalidatePath('/dashboard/factures')
  return { success: true }
}

export async function removeFactureLigneAction(ligneId: string, factureId: string): Promise<ActionResult> {
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('facture_lignes').delete().eq('id', ligneId)
  if (error) return { success: false, error: 'Erreur' }

  await recalculateFactureTotals(factureId)
  revalidatePath('/dashboard/factures')
  return { success: true }
}

async function recalculateFactureTotals(factureId: string) {
  const supabase = await createServiceRoleClient()

  const { data: facture } = await supabase
    .from('factures')
    .select('remise_pourcent, taux_tva, montant_paye')
    .eq('id', factureId)
    .single()

  const { data: lignes } = await supabase
    .from('facture_lignes')
    .select('montant_ht')
    .eq('facture_id', factureId)

  const subtotal = (lignes || []).reduce((s, l) => s + Number(l.montant_ht), 0)
  const remise = subtotal * ((facture?.remise_pourcent || 0) / 100)
  const montant_ht = subtotal - remise
  const montant_tva = montant_ht * ((facture?.taux_tva || 20) / 100)
  const montant_ttc = montant_ht + montant_tva
  const montant_restant = montant_ttc - (facture?.montant_paye || 0)

  await supabase.from('factures').update({
    montant_ht: Math.round(montant_ht * 100) / 100,
    montant_tva: Math.round(montant_tva * 100) / 100,
    montant_ttc: Math.round(montant_ttc * 100) / 100,
    remise_montant: Math.round(remise * 100) / 100,
    montant_restant: Math.round(Math.max(montant_restant, 0) * 100) / 100,
  }).eq('id', factureId)
}

export async function updateFactureStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updateData: Record<string, unknown> = { status }
  if (status === 'envoyee') updateData.date_envoi = new Date().toISOString()
  if (status === 'payee') updateData.date_paiement_complet = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('factures')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  // Si manuel "marquée payée" → propager au dossier OPCO si lié
  if (status === 'payee') {
    const { data: facture } = await supabase
      .from('factures').select('dossier_id, montant_ttc').eq('id', id).single()
    if (facture?.dossier_id) {
      // Update aussi montant_paye + restant à 0
      await supabase.from('factures').update({
        montant_paye: facture.montant_ttc,
        montant_restant: 0,
      }).eq('id', id)
      await supabase
        .from('dossiers_formation')
        .update({ opco_workflow_status: 'paye', paye_at: new Date().toISOString() })
        .eq('id', facture.dossier_id)
        .eq('organization_id', session.organization.id)
        .eq('opco_workflow_status', 'mise_en_paiement')
    }
  }

  await logAudit({ action: 'update_status', entity_type: 'facture', entity_id: id, details: { status } })
  revalidatePath('/dashboard/factures')
  revalidatePath('/dashboard/dossiers')
  return { success: true }
}

export async function createPaiementAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createPaiementSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('paiements')
    .insert({
      organization_id: session.organization.id,
      facture_id: parsed.data.facture_id,
      montant: parsed.data.montant,
      mode: parsed.data.mode,
      status: 'valide',
      date_paiement: parsed.data.date_paiement,
      reference: parsed.data.reference || null,
      payeur_nom: parsed.data.payeur_nom || null,
      payeur_type: parsed.data.payeur_type || null,
      notes: parsed.data.notes || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de l\'enregistrement du paiement' }

  // Recalculer montant_paye + restant + status de la facture
  await recalculateFacturePaiement(supabase, parsed.data.facture_id, session.organization.id)

  await logAudit({ action: 'create', entity_type: 'paiement', entity_id: data.id, details: { facture_id: parsed.data.facture_id, montant: parsed.data.montant } })
  revalidatePath('/dashboard/factures')
  revalidatePath('/dashboard/paiements')
  return { success: true, data }
}

/**
 * Recalcule le montant payé d'une facture (somme des paiements valides),
 * ajuste le restant et le status, et propage au dossier OPCO si applicable.
 */
async function recalculateFacturePaiement(supabase: any, factureId: string, organizationId: string) {
  // Total payé (paiements valides)
  const { data: paiements } = await supabase
    .from('paiements').select('montant')
    .eq('facture_id', factureId).eq('status', 'valide')
  const montantPaye = (paiements || []).reduce((s: number, p: any) => s + Number(p.montant || 0), 0)

  const { data: facture } = await supabase
    .from('factures').select('id, montant_ttc, dossier_id, status').eq('id', factureId).single()
  if (!facture) return

  const ttc = Number(facture.montant_ttc || 0)
  const restant = Math.max(0, ttc - montantPaye)
  let newStatus = facture.status
  const update: Record<string, unknown> = { montant_paye: montantPaye, montant_restant: restant }

  if (montantPaye >= ttc && ttc > 0) {
    newStatus = 'payee'
    update.status = 'payee'
    update.date_paiement_complet = new Date().toISOString().split('T')[0]
  } else if (montantPaye > 0) {
    if (facture.status !== 'payee') {
      newStatus = 'payee_partiellement'
      update.status = 'payee_partiellement'
    }
  }

  await supabase.from('factures').update(update).eq('id', factureId)

  // Propagation au dossier OPCO : si facture payée intégralement → dossier 'paye'
  if (newStatus === 'payee' && facture.dossier_id) {
    await supabase
      .from('dossiers_formation')
      .update({ opco_workflow_status: 'paye', paye_at: new Date().toISOString() })
      .eq('id', facture.dossier_id)
      .eq('organization_id', organizationId)
      .eq('opco_workflow_status', 'mise_en_paiement')  // sécurité : ne bascule que depuis mise_en_paiement
  }

  // Propagation affacturage : si facture payée → cession active (avancée) soldée
  if (newStatus === 'payee') {
    await supabase
      .from('cessions_creances')
      .update({ status: 'soldee', date_soldee: new Date().toISOString().split('T')[0] })
      .eq('facture_id', factureId)
      .eq('organization_id', organizationId)
      .in('status', ['en_attente_avance', 'avancee'])
    await supabase
      .from('factures')
      .update({ affacturage_status: 'soldee' })
      .eq('id', factureId)
      .not('affacturage_status', 'is', null)
  }
}

export async function deleteFactureAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Only allow deleting brouillon
  const { data: facture } = await supabase.from('factures').select('status').eq('id', id).single()
  if (facture?.status !== 'brouillon') {
    return { success: false, error: 'Seuls les brouillons peuvent être supprimés. Créez un avoir pour annuler.' }
  }

  const { error } = await supabase.from('factures').delete().eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'delete', entity_type: 'facture', entity_id: id })
  revalidatePath('/dashboard/factures')
  return { success: true }
}

export async function createAvoirAction(factureId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: facture } = await supabase
    .from('factures')
    .select('*, lignes:facture_lignes(*)')
    .eq('id', factureId)
    .single()

  if (!facture) return { success: false, error: 'Facture introuvable' }

  const { data: avoir, error } = await supabase
    .from('factures')
    .insert({
      organization_id: session.organization.id,
      numero: '',
      type: 'avoir',
      client_id: facture.client_id,
      facture_origine_id: factureId,
      dossier_id: facture.dossier_id,
      objet: `Avoir sur facture ${facture.numero}`,
      date_echeance: new Date().toISOString().split('T')[0],
      montant_ht: -Math.abs(facture.montant_ht),
      taux_tva: facture.taux_tva,
      montant_tva: -Math.abs(facture.montant_tva),
      montant_ttc: -Math.abs(facture.montant_ttc),
      montant_restant: 0,
      status: 'emise',
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création de l\'avoir' }

  // Cancel original
  await supabase.from('factures').update({ status: 'annulee' }).eq('id', factureId)

  await logAudit({ action: 'create_avoir', entity_type: 'facture', entity_id: avoir.id, details: { origine: factureId } })
  revalidatePath('/dashboard/factures')
  return { success: true, data: avoir }
}
