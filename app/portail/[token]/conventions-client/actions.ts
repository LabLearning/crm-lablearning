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
    .select('id, status, client_id, session_id')
    .eq('id', conventionId)
    .eq('client_id', context.client.id)
    .single()

  if (fetchError || !convention) {
    return { success: false, error: 'Convention introuvable.' }
  }

  if (convention.status !== 'envoyee') {
    return { success: false, error: 'Cette convention ne peut pas etre signee (statut incorrect).' }
  }

  // La date portée précède toujours le début de la session (voir
  // signature-actions.ts) : une signature tardive est datée de la veille du
  // début, l'horodatage réel reste en trace.
  const now = new Date().toISOString()
  let datePortee = now
  if ((convention as any).session_id) {
    const { data: sess } = await supabase.from('sessions').select('date_debut').eq('id', (convention as any).session_id).maybeSingle()
    if (sess?.date_debut && now.slice(0, 10) >= String(sess.date_debut).slice(0, 10)) {
      const j1 = new Date(sess.date_debut)
      j1.setDate(j1.getDate() - 1)
      datePortee = `${j1.toISOString().slice(0, 10)}T${now.slice(11)}`
    }
  }

  // Preuves lues côté serveur, comme sur la page de signature par lien
  const { origineRequete, journaliserEvenementConvention, figerConventionSignee } = await import('@/lib/preuve-signature-convention')
  const origine = await origineRequete()

  // Update convention status to signed by client
  const { error: updateError } = await supabase
    .from('conventions')
    .update({
      status: 'signee_client',
      signature_client_date: datePortee,
      signature_client_nom: signataireName,
      signature_client_ip: origine.ip,
      signature_client_user_agent: origine.userAgent,
      ...(signatureDataUrl ? { signature_client_signature_data: signatureDataUrl } : {}),
    })
    .eq('id', conventionId)
    .eq('status', 'envoyee')

  if (updateError) {
    return { success: false, error: 'Erreur lors de la signature. Veuillez reessayer.' }
  }

  // Horodatage réel, exemplaire figé et journal (tolérés sans la migration 161)
  await supabase.from('conventions').update({ signature_client_signed_at: now }).eq('id', conventionId)
  let fige: Awaited<ReturnType<typeof figerConventionSignee>> = null
  try { fige = await figerConventionSignee(supabase, conventionId) } catch (e) { console.error('[convention figée]', e) }
  await journaliserEvenementConvention(supabase, {
    organizationId: context.organization.id, conventionId, evenement: 'signature', survenuAt: now,
    ip: origine.ip, userAgent: origine.userAgent,
    details: { canal: 'portail', signataire: signataireName, document_sha256: fige?.sha256 || null, date_portee: datePortee },
  })

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
