'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createApprenantSchema } from '@/lib/validations/formation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ExtractedParticipant } from '@/lib/ai'
import type { ActionResult } from '@/lib/types'

export async function createApprenantAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createApprenantSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  // Déduplication : un apprenant au même prénom + nom, déjà rattaché au même
  // client, est réutilisé plutôt que dupliqué. Évite les doublons quand la
  // liste du formulaire de session est en retard (apprenant créé entre-temps).
  if (parsed.data.client_id) {
    const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const { data: existants } = await supabase
      .from('apprenants')
      .select('id, prenom, nom, email')
      .eq('organization_id', session.organization.id)
      .eq('client_id', parsed.data.client_id)
    const match = (existants || []).find((a: any) =>
      norm(a.nom || '') === norm(parsed.data.nom) &&
      norm(a.prenom || '') === norm(parsed.data.prenom || ''),
    )
    if (match) {
      // On renvoie l'existant : l'appelant l'inscrit sans créer de doublon
      return { success: true, data: match }
    }
  }

  const { data, error } = await supabase
    .from('apprenants')
    .insert({
      organization_id: session.organization.id,
      client_id: parsed.data.client_id || null,
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      whatsapp: parsed.data.whatsapp || null,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
      date_naissance: parsed.data.date_naissance || null,
      lieu_naissance: parsed.data.lieu_naissance || null,
      numero_securite_sociale: parsed.data.numero_securite_sociale || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      type_contrat: parsed.data.type_contrat || null,
      entreprise: parsed.data.entreprise || null,
      poste: parsed.data.poste || null,
      situation_handicap: parsed.data.situation_handicap || false,
      type_handicap: parsed.data.type_handicap || null,
      besoins_adaptation: parsed.data.besoins_adaptation || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'apprenant', entity_id: data.id })
  revalidatePath('/dashboard/apprenants')
  return { success: true, data }
}

export async function updateApprenantAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createApprenantSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('apprenants')
    .update({
      client_id: parsed.data.client_id || null,
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      whatsapp: parsed.data.whatsapp || null,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
      date_naissance: parsed.data.date_naissance || null,
      lieu_naissance: parsed.data.lieu_naissance || null,
      numero_securite_sociale: parsed.data.numero_securite_sociale || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      type_contrat: parsed.data.type_contrat || null,
      entreprise: parsed.data.entreprise || null,
      poste: parsed.data.poste || null,
      situation_handicap: parsed.data.situation_handicap || false,
      type_handicap: parsed.data.type_handicap || null,
      besoins_adaptation: parsed.data.besoins_adaptation || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'apprenant', entity_id: id })
  revalidatePath('/dashboard/apprenants')
  return { success: true }
}

export async function inscrireApprenantAction(apprenantId: string, sessionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Check capacity
  const { data: sessionData } = await supabase
    .from('sessions')
    .select('places_max')
    .eq('id', sessionId)
    .single()

  const { count: inscritsCount } = await supabase
    .from('inscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  if (sessionData && inscritsCount !== null && inscritsCount >= sessionData.places_max) {
    return { success: false, error: 'La session est complète (plus de places disponibles)' }
  }

  const { data, error } = await supabase
    .from('inscriptions')
    .insert({
      organization_id: session.organization.id,
      session_id: sessionId,
      apprenant_id: apprenantId,
      status: 'inscrit',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Cet apprenant est déjà inscrit à cette session' }
    return { success: false, error: 'Erreur lors de l\'inscription' }
  }

  // Convention déjà envoyée/signée ? → avenant automatique
  try {
    const { syncConventionAvenant } = await import('@/lib/convention-avenants')
    await syncConventionAvenant(supabase, sessionId, session.user.id)
  } catch (e) { console.error('[avenant]', e) }

  await logAudit({
    action: 'inscription',
    entity_type: 'inscription',
    entity_id: data.id,
    details: { apprenant_id: apprenantId, session_id: sessionId },
  })
  revalidatePath('/dashboard/apprenants')
  revalidatePath('/dashboard/sessions')
  return { success: true, data }
}

// Import en masse depuis la prévisualisation IA (les lignes ont déjà été validées par l'utilisateur).
export async function bulkCreateApprenantsAction(participants: ExtractedParticipant[]): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const rows = (participants || [])
    .filter((p) => (p.nom || '').trim())
    .map((p) => ({
      organization_id: session.organization.id,
      civilite: p.civilite || null,
      prenom: (p.prenom || '').trim(),
      nom: (p.nom || '').trim(),
      email: p.email || null,
      telephone: p.telephone || null,
      date_naissance: p.date_naissance || null,
      lieu_naissance: p.lieu_naissance || null,
      numero_securite_sociale: p.numero_securite_sociale || null,
      adresse: p.adresse || null,
      code_postal: p.code_postal || null,
      ville: p.ville || null,
      type_contrat: p.type_contrat || null,
      poste: p.poste || null,
    }))

  if (rows.length === 0) return { success: false, error: 'Aucun apprenant à enregistrer' }

  const { data, error } = await supabase.from('apprenants').insert(rows).select()
  if (error) return { success: false, error: "Erreur lors de l'enregistrement" }

  await logAudit({ action: 'import', entity_type: 'apprenant', details: { count: rows.length } })
  revalidatePath('/dashboard/apprenants')
  return { success: true, data }
}

export async function deleteApprenantAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('apprenants')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (inscriptions liées)' }

  await logAudit({ action: 'delete', entity_type: 'apprenant', entity_id: id })
  revalidatePath('/dashboard/apprenants')
  return { success: true }
}
