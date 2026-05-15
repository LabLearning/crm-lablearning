'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Signature d'un apprenant sur le device du formateur.
 * → enregistre signature_data, est_present=true, signed_at, signed_via.
 * → bloqué si la feuille (session+date+creneau) est déjà validée par le formateur.
 */
export async function signApprenantPresenceAction(
  token: string,
  emargementId: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  // Récupérer l'émargement + check feuille verrouillée
  const { data: em } = await supabase
    .from('emargements')
    .select('id, session_id, date, creneau')
    .eq('id', emargementId)
    .single()

  if (!em) return { success: false, error: 'Émargement introuvable' }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', em.session_id)
    .eq('date', em.date)
    .eq('creneau', em.creneau)
    .maybeSingle()

  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: signatureBase64,
      signed_at: new Date().toISOString(),
      signed_via: 'portail_formateur',
      motif_absence: null,
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/emargement`)
  return { success: true }
}

/**
 * Marque un apprenant absent (avec motif optionnel).
 * → est_present=false, signature_data effacée.
 */
export async function markAbsentAction(
  token: string,
  emargementId: string,
  motif: string | null,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const { data: em } = await supabase
    .from('emargements')
    .select('id, session_id, date, creneau')
    .eq('id', emargementId)
    .single()

  if (!em) return { success: false, error: 'Émargement introuvable' }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', em.session_id)
    .eq('date', em.date)
    .eq('creneau', em.creneau)
    .maybeSingle()

  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille est déjà validée et verrouillée' }
  }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: false,
      signature_data: null,
      signed_at: null,
      motif_absence: motif?.trim() || null,
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/emargement`)
  return { success: true }
}

/**
 * Le formateur valide la feuille d'émargement complète :
 *   → signe la feuille (sa propre signature)
 *   → date validated_at = maintenant
 *   → la feuille devient non modifiable
 */
export async function validerFeuilleByFormateurAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: 'matin' | 'apres_midi' | 'journee',
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  // Vérifier que la session appartient bien au formateur
  const { data: session } = await supabase
    .from('sessions')
    .select('id, formateur_id, organization_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.formateur_id !== context.formateur.id) {
    return { success: false, error: 'Session non autorisée' }
  }

  // Upsert : create ou update si déjà existante
  const { data: existing } = await supabase
    .from('emargement_feuilles')
    .select('id, validated_at')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .maybeSingle()

  if (existing?.validated_at) {
    return { success: false, error: 'Cette feuille est déjà validée' }
  }

  const payload = {
    organization_id: session.organization_id,
    session_id: sessionId,
    date,
    creneau,
    formateur_id: context.formateur.id,
    formateur_signature_data: signatureBase64,
    validated_at: new Date().toISOString(),
  }

  let error
  if (existing) {
    const res = await supabase
      .from('emargement_feuilles')
      .update(payload)
      .eq('id', existing.id)
    error = res.error
  } else {
    const res = await supabase
      .from('emargement_feuilles')
      .insert(payload)
    error = res.error
  }

  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/emargement`)
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

/**
 * Création d'une feuille d'émargement vide (un row par apprenant inscrit).
 */
export async function createEmargementAction(
  token: string,
  sessionId: string,
  date: string,
  creneau: 'matin' | 'apres_midi' | 'journee'
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'formateur') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const { data: inscriptions, error: inscriptionsError } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  if (inscriptionsError) {
    return { success: false, error: inscriptionsError.message }
  }

  if (!inscriptions || inscriptions.length === 0) {
    return { success: false, error: 'Aucun apprenant inscrit à cette session' }
  }

  const organizationId = context.organization.id
  const apprenantIds = inscriptions.map((i) => i.apprenant_id)

  const { data: existing } = await supabase
    .from('emargements')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .in('apprenant_id', apprenantIds)

  const existingApprenantIds = new Set((existing || []).map((e: any) => e.apprenant_id))

  const toInsert = inscriptions
    .filter((i) => !existingApprenantIds.has(i.apprenant_id))
    .map((i) => ({
      session_id: sessionId,
      apprenant_id: i.apprenant_id,
      date,
      creneau,
      est_present: false,
      organization_id: organizationId,
    }))

  if (toInsert.length === 0) {
    return { success: false, error: 'La feuille d\'émargement existe déjà pour cette date et ce créneau' }
  }

  const { error: insertError } = await supabase.from('emargements').insert(toInsert)

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  revalidatePath(`/portail/${token}/emargement`)
  return { success: true }
}

/**
 * Conservé pour compat. : toggle simple présent/absent (sans signature).
 * Utilisable seulement si la feuille n'est pas verrouillée.
 */
export async function togglePresenceAction(
  token: string,
  emargementId: string,
  estPresent: boolean
): Promise<{ success: boolean; error?: string }> {
  if (estPresent) {
    return { success: false, error: 'Utilisez la signature pour valider une présence' }
  }
  return markAbsentAction(token, emargementId, null)
}
