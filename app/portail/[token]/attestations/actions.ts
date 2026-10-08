'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPortalContext } from '@/lib/portal-auth'
import { refusSignature } from '@/lib/signature-image'

/**
 * Signature du stagiaire sur SON attestation d'assiduité et de règlement
 * AGEFICE. Autorisée uniquement après enregistrement du règlement (elle
 * certifie aussi le paiement) et une seule fois.
 */
export async function signerMonAttestationAction(
  token: string,
  dossierId: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  // Un cadre validé sans tracé n'est pas une signature : l'attestation ne se
  // signe qu'une fois
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }

  const context = await getPortalContext(token)
  if (!context || context.type !== 'apprenant') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()
  const { data: dossier } = await supabase
    .from('dossiers_agefice')
    .select('id, apprenant_id, mode_reglement, signature_stagiaire_data')
    .eq('id', dossierId)
    .eq('apprenant_id', context.apprenant.id)
    .maybeSingle()

  if (!dossier) return { success: false, error: 'Dossier introuvable' }
  if (dossier.signature_stagiaire_data) return { success: false, error: 'Cette attestation est déjà signée' }
  if (!dossier.mode_reglement) return { success: false, error: 'Le règlement n’est pas encore enregistré : l’attestation ne peut pas être signée' }

  const { error } = await supabase
    .from('dossiers_agefice')
    .update({ signature_stagiaire_data: signatureBase64, signature_stagiaire_date: new Date().toISOString() })
    .eq('id', dossier.id)
  if (error) return { success: false, error: 'Enregistrement impossible, réessayez' }

  revalidatePath(`/portail/${token}/attestations`)
  return { success: true }
}
