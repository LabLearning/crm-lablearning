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

/**
 * Modifie le prix, la durée ou la prise en charge d'une convention.
 *
 * Tant qu'elle est en brouillon, la modification est directe. Dès qu'elle a
 * été envoyée ou signée, la convention est mise à jour et un avenant numéroté
 * en garde la trace : le PDF régénéré porte la nouvelle valeur et mentionne
 * l'avenant, sans nouvelle signature à demander.
 */
export async function updateConventionContenuAction(
  id: string,
  contenu: { montant_ht?: number | null; duree_heures?: number | null; numero_prise_en_charge?: string | null },
): Promise<ActionResult<{ avenant: number | null }>> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, status, montant_ht, taux_tva, duree_heures, numero_prise_en_charge')
    .eq('id', id).eq('organization_id', session.organization.id).maybeSingle()
  if (!conv) return { success: false, error: 'Convention introuvable' }

  const { STATUTS_CONTRACTUELS, corrigerPrixConvention, enregistrerAvenantModification } = await import('@/lib/convention-avenants')
  const changements: { champ: string; libelle: string; avant: string | number | null; apres: string | number | null }[] = []
  if ('duree_heures' in contenu && Number(contenu.duree_heures ?? 0) !== Number(conv.duree_heures ?? 0)) {
    changements.push({ champ: 'duree_heures', libelle: 'Durée (h)', avant: conv.duree_heures ?? null, apres: contenu.duree_heures ?? null })
  }
  if ('numero_prise_en_charge' in contenu && (contenu.numero_prise_en_charge || '') !== (conv.numero_prise_en_charge || '')) {
    changements.push({ champ: 'numero_prise_en_charge', libelle: 'Numéro de prise en charge', avant: conv.numero_prise_en_charge || null, apres: contenu.numero_prise_en_charge || null })
  }
  const montantChange = 'montant_ht' in contenu && contenu.montant_ht != null && Number(contenu.montant_ht) !== Number(conv.montant_ht)
  if (!montantChange && changements.length === 0) return { success: true, data: { avenant: null } }

  if (STATUTS_CONTRACTUELS.includes(conv.status)) {
    // Le prix se corrige sans avenant ni mention ; la durée et la prise en charge gardent leur avenant
    if (montantChange) {
      const c = await corrigerPrixConvention(supabase, id, Number(contenu.montant_ht), session.user.id)
      if (!c) return { success: false, error: 'Le prix n’a pas pu être corrigé' }
      await logAudit({ action: 'corriger_prix_convention', entity_type: 'convention', entity_id: id, details: { numero: c.numero, avant: c.avant, apres: c.apres } })
    }
    let numeroAvenant: number | null = null
    if (changements.length) {
      const r = await enregistrerAvenantModification(supabase, id, { changements }, session.user.id)
      if (!r) return { success: false, error: "L'avenant n'a pas pu être créé" }
      numeroAvenant = r.numero
      await logAudit({ action: 'avenant_convention', entity_type: 'convention', entity_id: id, details: { numero: r.numero, changements } })
    }
    revalidatePath(`/dashboard/conventions/${id}`)
    revalidatePath('/dashboard/conventions')
    return { success: true, data: { avenant: numeroAvenant } }
  }

  const patch: Record<string, unknown> = {}
  if (montantChange) {
    const tva = Number(conv.taux_tva || 0)
    patch.montant_ht = Number(contenu.montant_ht)
    patch.montant_ttc = Math.round(Number(contenu.montant_ht) * (1 + tva / 100) * 100) / 100
  }
  for (const c of changements) patch[c.champ] = c.apres
  const { error } = await supabase.from('conventions').update(patch).eq('id', id).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }
  await logAudit({ action: 'update', entity_type: 'convention', entity_id: id, details: contenu })
  revalidatePath(`/dashboard/conventions/${id}`)
  revalidatePath('/dashboard/conventions')
  return { success: true, data: { avenant: null } }
}

/**
 * Retire un avenant de prix créé pour corriger une erreur de saisie : le prix
 * signé était faux, le client connaît le bon. La convention garde le prix
 * corrigé et n'en fait plus mention ; la correction reste tracée dans les
 * notes internes de la convention et au journal d'activité.
 *
 * Seul le dernier avenant se retire, pour que la numérotation reste continue,
 * et seulement s'il porte sur le prix : un changement de participants ne se
 * corrige pas ainsi.
 */
export async function retirerAvenantCorrectionAction(avenantId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: avenant } = await supabase
    .from('convention_avenants').select('id, convention_id, numero, motif, montant_avant, montant_apres, created_at')
    .eq('id', avenantId).eq('organization_id', session.organization.id).maybeSingle()
  if (!avenant) return { success: false, error: 'Avenant introuvable' }
  if (avenant.montant_apres == null) return { success: false, error: 'Seul un avenant de prix se retire comme correction d’erreur' }

  const { data: suivants } = await supabase
    .from('convention_avenants').select('id').eq('convention_id', avenant.convention_id).gt('numero', avenant.numero).limit(1)
  if (suivants?.length) return { success: false, error: 'Un avenant plus récent existe : retirez d’abord celui-là' }

  const { data: conv } = await supabase
    .from('conventions').select('id, numero, notes_internes')
    .eq('id', avenant.convention_id).eq('organization_id', session.organization.id).maybeSingle()
  if (!conv) return { success: false, error: 'Convention introuvable' }

  const { error } = await supabase.from('convention_avenants').delete().eq('id', avenantId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors du retrait de l’avenant' }

  const euros = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0\u2009]/g, ' ')} €`
  const note = `[${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}] Prix corrigé de ${euros(avenant.montant_avant)} à ${euros(avenant.montant_apres)} : erreur de saisie connue du client. L’avenant n°${avenant.numero} a été retiré, la convention affiche le prix corrigé sans mention.`
  await supabase.from('conventions')
    .update({ notes_internes: [conv.notes_internes, note].filter(Boolean).join('\n') })
    .eq('id', conv.id).eq('organization_id', session.organization.id)

  await logAudit({
    action: 'retirer_avenant_correction', entity_type: 'convention', entity_id: conv.id,
    details: { numero: conv.numero, avenant: avenant.numero, motif: avenant.motif, montant_avant: avenant.montant_avant, montant_apres: avenant.montant_apres, avenant_cree_le: avenant.created_at },
  })
  revalidatePath('/dashboard/conventions')
  revalidatePath(`/dashboard/conventions/${conv.id}`)
  return { success: true }
}
