'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { refusSignature } from '@/lib/signature-image'

/**
 * Signature d'un document par un apprenant ou un formateur depuis son portail.
 * → enregistre signature_data (base64), status='signe', signed_at.
 * Sécurité : la signature doit cibler l'email du porteur du token et être en attente.
 */
export async function signDocumentAction(
  token: string | null,
  signatureId: string,
  signatureBase64: string,
): Promise<{ success: boolean; error?: string }> {
  // Un cadre validé sans tracé n'est pas une signature
  const refus = refusSignature(signatureBase64)
  if (refus) return { success: false, error: refus }

  // Deux accès possibles : token de portail (legacy) OU compte connecté
  // (espace formateur/apprenant — plus de dépendance au token).
  let email: string | null = null
  if (token) {
    const context = await getPortalContext(token)
    if (!context || (context.type !== 'apprenant' && context.type !== 'formateur')) {
      return { success: false, error: 'Accès non autorisé' }
    }
    email = context.type === 'apprenant' ? context.apprenant.email : (context as any).formateur.email
  } else {
    try {
      const { getSession } = await import('@/lib/auth')
      const session = await getSession()
      email = session.user.email || null
    } catch {
      return { success: false, error: 'Accès non autorisé' }
    }
  }

  if (!email) {
    return { success: false, error: 'Aucune adresse associée à ce compte' }
  }

  const supabase = await createServiceRoleClient()

  // Récupérer la signature : le contrôle d'appartenance se fait sur l'email du
  // signataire (identique pour un accès par token ou par compte connecté).
  const { data: signature } = await supabase
    .from('signatures')
    .select('id, status, signataire_email, expire_at, organization_id')
    .eq('id', signatureId)
    .single()

  if (!signature || signature.signataire_email !== email) {
    return { success: false, error: 'Document à signer introuvable' }
  }

  if (signature.status !== 'en_attente') {
    return { success: false, error: 'Ce document a déjà été traité' }
  }

  if (signature.expire_at && new Date(signature.expire_at) < new Date()) {
    await supabase.from('signatures').update({ status: 'expire' }).eq('id', signatureId)
    return { success: false, error: 'Le délai de signature est expiré' }
  }

  const { error } = await supabase
    .from('signatures')
    .update({
      status: 'signe',
      signature_data: signatureBase64,
      signed_at: new Date().toISOString(),
    })
    .eq('id', signatureId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/portail/${token}/documents`)
  return { success: true }
}
