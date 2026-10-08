'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { refusSignature } from '@/lib/signature-image'

/**
 * Signature publique (par token) du mandat POEI par le gérant.
 * L'horodatage réel est conservé pour la traçabilité ; la date portée sur
 * le mandat reste sa date d'émission.
 */
export async function signMandatAction(
  token: string,
  signatureBase64: string,
  nom: string,
): Promise<{ success: boolean; error?: string }> {
  // Un cadre validé sans tracé, ou une image qui ne se lit pas, n'est pas une
  // signature : un mandat validé ne se resigne pas
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }
  if (!nom?.trim()) return { success: false, error: 'Nom requis' }

  const supabase = await createServiceRoleClient()
  const { data: mandat } = await supabase
    .from('poei_mandats')
    .select('id, signed_at, token_expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!mandat) return { success: false, error: 'Lien invalide' }
  if (mandat.signed_at) return { success: false, error: 'Ce mandat est déjà signé' }
  if (mandat.token_expires_at && new Date(mandat.token_expires_at) < new Date()) {
    return { success: false, error: 'Ce lien a expiré' }
  }

  const h = await headers()
  const { error } = await supabase
    .from('poei_mandats')
    .update({
      signed_at: new Date().toISOString(),
      signature_data: signatureBase64,
      signataire_nom: nom.trim(),
      ip_address: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: h.get('user-agent') || null,
    })
    .eq('id', mandat.id)

  if (error) { console.error('[sign mandat]', error); return { success: false, error: "Erreur lors de l'enregistrement" } }
  return { success: true }
}
