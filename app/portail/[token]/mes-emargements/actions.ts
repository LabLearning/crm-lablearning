'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPortalContext } from '@/lib/portal-auth'

/**
 * Signature de l'apprenant sur SON propre émargement, depuis son portail.
 * Mêmes règles que la signature sur le device du formateur : présence posée
 * avec la signature, bloquée si la feuille du créneau est déjà validée.
 * Un créneau futur ne se signe pas.
 */
export async function signerMonEmargementAction(
  token: string,
  emargementId: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'apprenant') {
    return { success: false, error: 'Accès non autorisé' }
  }
  if (!signatureBase64?.startsWith('data:image/')) {
    return { success: false, error: 'Signature invalide' }
  }

  const supabase = await createServiceRoleClient()
  const { data: em } = await supabase
    .from('emargements')
    .select('id, session_id, date, creneau, apprenant_id, signature_data, motif_absence')
    .eq('id', emargementId)
    .eq('apprenant_id', context.apprenant.id)
    .single()

  if (!em) return { success: false, error: 'Émargement introuvable' }
  if (em.signature_data) return { success: false, error: 'Ce créneau est déjà signé' }
  if (em.motif_absence) return { success: false, error: 'Le formateur vous a déclaré absent sur ce créneau' }
  if (String(em.date) > new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'Ce créneau n\'a pas encore eu lieu' }
  }

  const { data: feuille } = await supabase
    .from('emargement_feuilles')
    .select('validated_at')
    .eq('session_id', em.session_id)
    .eq('date', em.date)
    .eq('creneau', em.creneau)
    .maybeSingle()
  if (feuille?.validated_at) {
    return { success: false, error: 'La feuille de ce créneau est déjà validée' }
  }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: signatureBase64,
      signed_at: new Date().toISOString(),
      signed_via: 'portail_apprenant',
      motif_absence: null,
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/mes-emargements`)
  revalidatePath(`/dashboard/sessions/${em.session_id}`)
  return { success: true }
}

/**
 * Signature d'une JOURNÉE entière : une seule signature du stagiaire remplit
 * tous ses créneaux signables du jour (matin + après-midi) — la feuille
 * d'émargement garde bien une signature par demi-journée, capturée une fois.
 * Mêmes règles que la signature par créneau : pas de créneau futur, pas de
 * créneau déjà signé ou marqué absent, pas de feuille déjà validée.
 */
export async function signerMaJourneeAction(
  token: string,
  sessionId: string,
  date: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string; data?: { signes: number } }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'apprenant') {
    return { success: false, error: 'Accès non autorisé' }
  }
  if (!signatureBase64?.startsWith('data:image/')) {
    return { success: false, error: 'Signature invalide' }
  }
  if (String(date) > new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'Cette journée n\'a pas encore eu lieu' }
  }

  const supabase = await createServiceRoleClient()
  const { data: ems } = await supabase
    .from('emargements')
    .select('id, creneau, est_present, signature_data, motif_absence')
    .eq('apprenant_id', context.apprenant.id)
    .eq('session_id', sessionId)
    .eq('date', date)
  // « présent = non » est l'état d'une ligne pas encore signée : seul un motif
  // d'absence, posé par le formateur, retire le créneau des signables
  const signables = (ems || []).filter((e) => !e.signature_data && !e.motif_absence)
  if (!signables.length) return { success: false, error: 'Aucun créneau à signer sur cette journée' }

  // Feuilles déjà validées par le formateur : créneaux verrouillés
  const { data: feuilles } = await supabase
    .from('emargement_feuilles')
    .select('creneau, validated_at')
    .eq('session_id', sessionId)
    .eq('date', date)
  const verrouilles = new Set((feuilles || []).filter((f) => f.validated_at).map((f) => f.creneau))
  const cibles = signables.filter((e) => !verrouilles.has(e.creneau))
  if (!cibles.length) return { success: false, error: 'Les feuilles de cette journée sont déjà validées' }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: signatureBase64,
      signed_at: new Date().toISOString(),
      signed_via: 'portail_apprenant',
      motif_absence: null,
    })
    .in('id', cibles.map((e) => e.id))
  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/mes-emargements`)
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { signes: cibles.length } }
}
