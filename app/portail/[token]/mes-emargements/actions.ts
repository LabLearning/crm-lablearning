'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPortalContext } from '@/lib/portal-auth'
import { refusSignature } from '@/lib/signature-image'

// La signature créneau par créneau (signerMonEmargementAction) n'est plus
// proposée depuis la signature par journée (04/09/2026) : retirée, elle
// restait un point d'entrée public sans écran.

/**
 * Signature d'une JOURNÉE entière : une seule signature du stagiaire remplit
 * tous ses créneaux signables du jour (matin + après-midi) — la feuille
 * d'émargement garde bien une signature par demi-journée, capturée une fois.
 * Mêmes règles que la signature sur le device du formateur : pas de créneau
 * futur, pas de créneau déjà signé ou marqué absent, pas de feuille déjà
 * validée, et seulement pour une session où le stagiaire est encore inscrit.
 */
export async function signerMaJourneeAction(
  token: string,
  sessionId: string,
  date: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string; data?: { signes: number } }> {
  // Un cadre validé sans tracé n'est pas une signature : la même image remplit
  // tous les créneaux du jour
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }

  const context = await getPortalContext(token)
  if (!context || context.type !== 'apprenant') {
    return { success: false, error: 'Accès non autorisé' }
  }
  if (typeof sessionId !== 'string' || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: 'Journée introuvable' }
  }
  if (String(date) > new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'Cette journée n\'a pas encore eu lieu' }
  }

  const supabase = await createServiceRoleClient()

  // Un stagiaire retiré de la session (inscription annulée ou abandon) garde
  // ses lignes non signées : il ne doit pas pouvoir y réapparaître présent
  const { data: inscription } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('apprenant_id', context.apprenant.id)
    .not('status', 'in', '("annule","abandonne")')
    .limit(1)
    .maybeSingle()
  if (!inscription) {
    return { success: false, error: 'Vous n\'êtes plus inscrit à cette session : adressez-vous à l\'organisme de formation' }
  }

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
    // Ni une signature ni une absence posées entre-temps ne s'écrasent
    .is('signature_data', null)
    .is('motif_absence', null)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/mes-emargements`)
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { signes: cibles.length } }
}
