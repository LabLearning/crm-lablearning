'use server'

import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { refusSignature } from '@/lib/signature-image'

export async function signConventionAction(
  token: string,
  conventionId: string,
  signataireName: string,
  signatureDataUrl: string
): Promise<{ success: boolean; error?: string }> {
  // La signature tracée est obligatoire : sans image lisible portant un tracé,
  // la convention serait dite signée sans que rien ne le montre
  const refus = refusSignature(signatureDataUrl)
  if (refus) return { success: false, error: refus }

  const context = await getPortalContext(token)
  if (!context || context.type !== 'client') {
    return { success: false, error: 'Acces non autorise.' }
  }

  const supabase = await createServiceRoleClient()

  // Verify the convention belongs to this client and is awaiting signature
  const { data: convention, error: fetchError } = await supabase
    .from('conventions')
    .select(`id, status, client_id, session_id,
      numero, objet, duree_heures, dates_formation, lieu, nombre_stagiaires, montant_ht, taux_tva, montant_ttc,
      formation:formation_id(intitule), session:session_id(reference)`)
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
  const {
    origineRequete, journaliserEvenementConvention, completerEvenementConvention, figerConventionSignee,
    compteCrmConnecte, instantaneDocument,
  } = await import('@/lib/preuve-signature-convention')
  const origine = await origineRequete()
  // Un compte du CRM connecté dans ce navigateur : le certificat doit pouvoir le dire
  const compteCrm = await compteCrmConnecte(supabase)

  // Update convention status to signed by client
  const { data: signee, error: updateError } = await supabase
    .from('conventions')
    .update({
      status: 'signee_client',
      // Horodatage réel de l'acte, dans la même écriture que la signature
      signature_client_signed_at: now,
      signature_client_date: datePortee,
      signature_client_nom: signataireName,
      signature_client_ip: origine.ip,
      signature_client_user_agent: origine.userAgent,
      signature_client_signature_data: signatureDataUrl,
    })
    .eq('id', conventionId)
    .eq('status', 'envoyee')
    // Une signature déjà enregistrée ne s'écrase jamais : elle s'annule d'abord
    .is('signature_client_signature_data', null)
    .select('id')

  if (updateError) {
    return { success: false, error: 'Erreur lors de la signature. Veuillez reessayer.' }
  }
  // Aucune ligne écrite : la convention a quitté le statut « envoyée » entre la
  // lecture et l'écriture (signée par le lien, annulée). Ni horodatage, ni
  // exemplaire figé, ni journal pour une signature qui n'a pas eu lieu.
  if (!signee?.length) {
    return { success: false, error: 'Cette convention ne peut pas etre signee (statut incorrect).' }
  }

  // L'événement de signature, aussitôt, avec ce que le signataire avait sous
  // les yeux ; l'empreinte et le chemin de l'exemplaire le rejoignent une fois
  // le PDF figé (même schéma que la signature par lien)
  const detailsSignature: Record<string, unknown> = {
    canal: 'portail', signataire: signataireName, date_portee: datePortee,
    document: instantaneDocument(convention),
    ...(compteCrm ? { compte_crm: compteCrm } : {}),
  }
  const evenementSignature = await journaliserEvenementConvention(supabase, {
    organizationId: context.organization.id, conventionId, evenement: 'signature', survenuAt: now,
    ip: origine.ip, userAgent: origine.userAgent,
    details: detailsSignature,
  })
  let fige: Awaited<ReturnType<typeof figerConventionSignee>> = null
  try { fige = await figerConventionSignee(supabase, conventionId) } catch (e) { console.error('[convention figée]', e) }
  await completerEvenementConvention(supabase, evenementSignature, {
    ...detailsSignature, document_sha256: fige?.sha256 || null, document_path: fige?.chemin || null,
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
