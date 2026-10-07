'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import { ensureCertificatSignature, paramsCertificatSignature, urlSignatureCertificat } from '@/lib/poei-emails'

const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
const VALIDITE_LIEN_JOURS = 60

// Un lien remis ou envoyé aujourd'hui vaut 60 jours à partir d'aujourd'hui :
// sans cela, une relance tardive transmettrait un lien déjà expiré.
const prolongerLien = (supabase: any, sigId: string) => supabase.from('certificat_signatures')
  .update({ token_expires_at: new Date(Date.now() + VALIDITE_LIEN_JOURS * 86400000).toISOString() })
  .eq('id', sigId)

/** Envoie au candidat, par email, le lien de signature de son certificat. */
export async function sendCertificatSignatureAction(poeiId: string, apprenantId: string): Promise<ActionResult & { data?: { email: string } }> {
  const session = await getSession()
  if (['apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const r = await ensureCertificatSignature(supabase, session.organization.id, poeiId, apprenantId, session.user.id)
  if ('error' in r) return { success: false, error: r.error }
  const { sig, appr } = r as any

  if (!appr.email) return { success: false, error: 'Ce candidat n\'a pas d\'adresse email' }
  if (sig.signed_at) return { success: false, error: 'Ce certificat est déjà signé' }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()

  await prolongerLien(supabase, sig.id)
  try {
    const { sendDocumentEmail } = await import('@/lib/email')
    // Textes partagés avec l'aperçu (lib/poei-emails)
    await sendDocumentEmail({
      to: appr.email,
      orgName: org?.name || 'Lab Learning',
      orgEmail: (org as any)?.email_contact || org?.email,
      orgLogoUrl: (org as any)?.logo_url,
      qualiopiCertified: (org as any)?.is_qualiopi !== false,
      ...paramsCertificatSignature(appr, urlSignatureCertificat(sig.token)),
      organizationId: session.organization.id,
      entityType: 'poei', entityId: poeiId, triggeredBy: session.user.id,
    })
  } catch (e) {
    console.error('[certif email]', e)
    return { success: false, error: "Échec de l'envoi de l'email" }
  }

  await supabase.from('certificat_signatures').update({ sent_at: new Date().toISOString() }).eq('id', sig.id)
  await logAudit({ action: 'send_signature', entity_type: 'certificat_signature', entity_id: sig.id })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { email: appr.email } }
}

/** Envoie le lien à TOUS les candidats de la POEI qui ont un email et n'ont pas signé. */
export async function sendAllCertificatSignaturesAction(poeiId: string): Promise<ActionResult & { data?: { sent: number; skipped: number } }> {
  const session = await getSession()
  if (['apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: cands } = await supabase
    .from('poei_candidats').select('apprenant_id').eq('poei_id', poeiId).eq('organization_id', session.organization.id)
  const ids = (cands || []).map((c: any) => c.apprenant_id).filter(Boolean)
  let sent = 0, skipped = 0
  for (const id of ids) {
    const r = await sendCertificatSignatureAction(poeiId, id)
    if (r.success) sent++; else skipped++
  }
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { sent, skipped } }
}

/** Génère le lien sans envoyer d'email (copier/coller manuel). */
export async function getCertificatSignatureLinkAction(poeiId: string, apprenantId: string): Promise<ActionResult & { data?: { url: string } }> {
  const session = await getSession()
  if (['apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const r = await ensureCertificatSignature(supabase, session.organization.id, poeiId, apprenantId, session.user.id)
  if ('error' in r) return { success: false, error: r.error }
  const sig = (r as any).sig
  if (sig.signed_at) return { success: false, error: 'Ce certificat est déjà signé' }
  await prolongerLien(supabase, sig.id)
  await logAudit({ action: 'lien_signature_certificat', entity_type: 'certificat_signature', entity_id: sig.id, details: { poei_id: poeiId, apprenant_id: apprenantId } })
  return { success: true, data: { url: urlSignatureCertificat(sig.token) } }
}

/**
 * Envoie au représentant de l'employeur le lien de signature de l'attestation
 * de développement de compétences.
 *
 * Il signe une fois pour tous les candidats de la POEI : c'est le formulaire
 * France Travail qui veut sa signature sur chaque attestation, pas neuf
 * cérémonies de signature. Le destinataire est le représentant renseigné sur
 * le projet ; à défaut, le contact signataire du client.
 *
 * `preview` renvoie le mail sans l'envoyer. `lienSeul` renvoie le lien de
 * signature sans rien envoyer, pour le transmettre soi-même : il fonctionne
 * aussi quand l'entreprise n'a aucun contact avec email.
 */
export async function sendSignatureEmployeurAction(
  poeiId: string,
  opts?: { preview?: boolean; lienSeul?: boolean },
): Promise<ActionResult & { data?: { email: string | null; html?: string; subject?: string; url?: string } }> {
  const session = await getSession()
  if (['apprenant', 'formateur'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, date_debut, date_fin, session_id, client_id, formation:formation_id(intitule), client:client_id(raison_sociale, nom_commercial)')
    .eq('id', poeiId).eq('organization_id', session.organization.id).single()
  if (!poei) return { success: false, error: 'POEI introuvable' }

  // Le contact référent de l'entreprise : signataire, à défaut principal.
  let nom = ''
  let email: string | null = null
  if ((poei as any).client_id) {
    const { data: contacts } = await supabase
      .from('contacts').select('prenom, nom, email, est_signataire, est_principal')
      .eq('client_id', (poei as any).client_id)
    const c = (contacts || []).find((x: any) => x.est_signataire && x.email)
      || (contacts || []).find((x: any) => x.est_principal && x.email)
      || (contacts || []).find((x: any) => x.email)
    if (c) { email = c.email; nom = nom || [c.prenom, c.nom].filter(Boolean).join(' ').trim() }
  }
  if (!email && !opts?.lienSeul) {
    return { success: false, error: "Aucun contact référent avec email sur l'entreprise : ajoutez-le sur la fiche client" }
  }

  const { data: existing } = await supabase
    .from('certificat_signatures').select('*')
    .eq('organization_id', session.organization.id)
    .eq('poei_id', poeiId).eq('role', 'employeur').maybeSingle()
  if (existing?.signed_at) return { success: false, error: "L'employeur a déjà signé" }

  const dateSignature = (poei as any).date_fin || (poei as any).date_debut || null
  let sig = existing
  if (!sig) {
    const { data: created, error } = await supabase.from('certificat_signatures').insert({
      organization_id: session.organization.id,
      poei_id: poeiId,
      session_id: (poei as any).session_id || null,
      apprenant_id: null,
      role: 'employeur',
      email,
      date_signature: dateSignature,
      created_by: session.user.id,
    }).select('*').single()
    if (error) {
      console.error('[sig employeur]', error)
      return { success: false, error: 'Erreur lors de la préparation du lien (migration 131 appliquée ?)' }
    }
    sig = created
  } else if (email && existing.email !== email) {
    await supabase.from('certificat_signatures').update({ email }).eq('id', existing.id)
  }

  const url = `${APP()}/certificat/${sig.token}/signer`
  const prolonger = () => prolongerLien(supabase, sig.id)

  if (opts?.lienSeul) {
    const { error } = await prolonger()
    if (error) return { success: false, error: 'Erreur lors de la préparation du lien' }
    await logAudit({ action: 'lien_signature_employeur', entity_type: 'poei', entity_id: poeiId })
    return { success: true, data: { email, url } }
  }

  const { count: nbCandidats } = await supabase
    .from('poei_candidats').select('id', { count: 'exact', head: true }).eq('poei_id', poeiId)

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const clientNom = (poei as any).client?.nom_commercial || (poei as any).client?.raison_sociale || 'votre établissement'
  const formationNom = (poei as any).formation?.intitule || 'la formation'

  // Mêmes textes pour l'aperçu et l'envoi : un aperçu qui divergerait de ce
  // qui part vraiment ferait pire que pas d'aperçu du tout.
  const emailParams = {
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || org?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: nom || 'Madame, Monsieur',
    subject: `Signature — Attestation de développement de compétences (${(poei as any).numero || 'POEI'})`,
    docTitle: "Attestation de développement de compétences",
    intro: `La POEI menée chez ${clientNom} sur « ${formationNom} » touche à sa fin. En qualité de représentant de l'établissement, votre signature est requise sur l'attestation de développement de compétences remise à France Travail — une seule signature couvre les ${nbCandidats || ''} candidats du projet.`,
    ctaLabel: "Signer l'attestation",
    ctaUrl: url,
    footerNote: `Lien personnel, à ne pas transmettre. Valable ${VALIDITE_LIEN_JOURS} jours.`,
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { email, html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject } }
  }

  await prolonger()
  try {
    const { sendDocumentEmail } = await import('@/lib/email')
    await sendDocumentEmail({
      ...emailParams,
      to: email!,
      organizationId: session.organization.id,
      entityType: 'poei', entityId: poeiId, triggeredBy: session.user.id,
    })
  } catch (e) {
    console.error('[email sig employeur]', e)
    return { success: false, error: "L'envoi de l'email a échoué" }
  }

  await supabase.from('certificat_signatures').update({ sent_at: new Date().toISOString() }).eq('id', sig.id)
  await logAudit({ action: 'send_signature_employeur', entity_type: 'poei', entity_id: poeiId, details: { email } })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { email } }
}
