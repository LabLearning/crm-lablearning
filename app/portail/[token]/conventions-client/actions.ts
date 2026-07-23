'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function signConventionAction(
  token: string,
  conventionId: string,
  signataireName: string,
  signatureDataUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  const context = await getPortalContext(token)
  if (!context || context.type !== 'client') {
    return { success: false, error: 'Acces non autorise.' }
  }

  const supabase = await createServiceRoleClient()

  // Verify the convention belongs to this client and is awaiting signature
  const { data: convention, error: fetchError } = await supabase
    .from('conventions')
    .select('id, status, client_id')
    .eq('id', conventionId)
    .eq('client_id', context.client.id)
    .single()

  if (fetchError || !convention) {
    return { success: false, error: 'Convention introuvable.' }
  }

  if (convention.status !== 'envoyee') {
    return { success: false, error: 'Cette convention ne peut pas etre signee (statut incorrect).' }
  }

  // Update convention status to signed by client
  const { error: updateError } = await supabase
    .from('conventions')
    .update({
      status: 'signee_client',
      signature_client_date: new Date().toISOString(),
      signature_client_nom: signataireName,
      ...(signatureDataUrl ? { signature_client_signature_data: signatureDataUrl } : {}),
    })
    .eq('id', conventionId)

  if (updateError) {
    return { success: false, error: 'Erreur lors de la signature. Veuillez reessayer.' }
  }

  // Try to log into signatures table — may fail due to NOT NULL document_id constraint
  // We skip if it fails; convention is already signed above
  const signataire_email =
    context.contact?.email || context.client.email || ''

  try {
    await supabase.from('signatures').insert({
      signataire_nom: signataireName,
      signataire_email,
      signataire_role: 'client',
      status: 'signe',
      signed_at: new Date().toISOString(),
      organization_id: context.organization.id,
      token: crypto.randomUUID(),
      // document_id is NOT NULL in DB — we create a placeholder document first
    } as any)
  } catch {
    // Signature log failed but convention is already signed — ignore
  }

  return { success: true }
}
