'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { randomBytes, createHash } from 'crypto'
import type { ActionResult } from '@/lib/types'

/** Génère un token de signature unique pour une convention et retourne le lien public */
export async function generateSignatureLinkAction(conventionId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, organization_id, signature_token, status, session_id, participants_snapshot')
    .eq('id', conventionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!conv) return { success: false, error: 'Convention introuvable' }

  // ── Contrôle de complétude : blocage si mention obligatoire manquante ──
  const { checkConventionCompleteness, formatConventionIssues } = await import('@/lib/convention-checklist')
  const check = await checkConventionCompleteness(supabase, conventionId)
  if (check && !check.ok) {
    return {
      success: false,
      error: `Convention incomplète : impossible de l'envoyer en signature. Merci de compléter les champs obligatoires suivants → ${formatConventionIssues(check.blocking)}`,
    }
  }

  // Fige la liste des participants au moment de l'envoi : c'est la référence
  // contractuelle — toute modification ultérieure génèrera un avenant
  if (conv.session_id && !Array.isArray(conv.participants_snapshot)) {
    const { data: inscriptions } = await supabase
      .from('inscriptions')
      .select('apprenant:apprenants(id, nom, prenom)')
      .eq('session_id', conv.session_id)
      .not('status', 'in', '("annule","abandonne")')
    const snapshot = (inscriptions || [])
      .map((i: any) => i.apprenant)
      .filter(Boolean)
      .map((a: any) => ({ apprenant_id: a.id, nom: a.nom, prenom: a.prenom }))
    await supabase
      .from('conventions')
      .update({ participants_snapshot: snapshot })
      .eq('id', conventionId)
  }

  // Le lien vaut 30 jours à compter de CET envoi. Un jeton existant est
  // réutilisé (le lien déjà reçu reste bon) mais sa validité repart : sans
  // ça, tout renvoi après 30 jours envoyait un lien déjà expiré (CT Le Havre,
  // conventions renvoyées trois fois sur un jeton mort du 3 août).
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)
  let token = conv.signature_token
  if (!token) {
    token = createHash('sha256').update(randomBytes(32)).digest('hex')
    await supabase
      .from('conventions')
      .update({
        signature_token: token,
        signature_token_expires_at: expiresAt.toISOString(),
        status: conv.status === 'brouillon' ? 'envoyee' : conv.status,
        sent_at: conv.status === 'brouillon' ? new Date().toISOString() : undefined,
      })
      .eq('id', conventionId)
  } else {
    await supabase
      .from('conventions')
      .update({ signature_token_expires_at: expiresAt.toISOString() })
      .eq('id', conventionId)
  }

  await logAudit({ action: 'generate_signature_link', entity_type: 'convention', entity_id: conventionId })
  revalidatePath('/dashboard/conventions')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  return { success: true, data: { url: `${appUrl}/convention/${token}/signer` } }
}

/**
 * Annule une demande de signature en cours : invalide le lien (token) et
 * remet la convention en brouillon. Refuse si déjà signée. Réinitialise le
 * snapshot des participants pour qu'un nouvel envoi reparte des données à jour.
 */
export async function cancelSignatureRequestAction(conventionId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, status, signature_client_date')
    .eq('id', conventionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!conv) return { success: false, error: 'Convention introuvable' }
  if (conv.signature_client_date || ['signee_client', 'signee_complete'].includes(conv.status)) {
    return { success: false, error: 'Cette convention est déjà signée — annulation impossible.' }
  }

  const { error } = await supabase
    .from('conventions')
    .update({
      signature_token: null,
      signature_token_expires_at: null,
      sent_at: null,
      participants_snapshot: null,
      status: 'brouillon',
    })
    .eq('id', conventionId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: "Impossible d'annuler la demande" }

  await logAudit({ action: 'cancel_signature_request', entity_type: 'convention', entity_id: conventionId })
  revalidatePath('/dashboard/conventions')
  revalidatePath(`/dashboard/conventions/${conventionId}`)
  return { success: true }
}

/**
 * Annule une convention DÉJÀ SIGNÉE : efface la signature (client + OF) et le
 * lien, repasse en brouillon et remet la session liée en 'confirmee' si elle
 * avait été validée par la signature. Réservé aux rôles de gestion (les emails
 * déjà envoyés ne peuvent pas être rappelés).
 */
export async function annulerConventionSigneeAction(conventionId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, numero, status, session_id')
    .eq('id', conventionId).eq('organization_id', session.organization.id).single()
  if (!conv) return { success: false, error: 'Convention introuvable' }

  const { error } = await supabase
    .from('conventions')
    .update({
      status: 'brouillon',
      signature_client_date: null, signature_client_nom: null, signature_client_signature_data: null,
      signature_client_ip: null, signature_client_user_agent: null,
      signature_of_date: null, signature_of_nom: null,
      signature_token: null, signature_token_expires_at: null,
      participants_snapshot: null,
      akto_dossier_status: 'non_envoye',
    })
    .eq('id', conventionId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: "Impossible d'annuler la convention" }

  // La signature avait pu valider la session liée → on revient à 'confirmee'
  if (conv.session_id) {
    await supabase.from('sessions').update({ status: 'confirmee' })
      .eq('id', conv.session_id).eq('organization_id', session.organization.id).eq('status', 'validee')
  }

  await logAudit({ action: 'cancel_signed_convention', entity_type: 'convention', entity_id: conventionId, details: { numero: conv.numero } })
  revalidatePath('/dashboard/conventions')
  revalidatePath(`/dashboard/conventions/${conventionId}`)
  return { success: true }
}

/** Action publique : enregistre la signature client (depuis la page /convention/[token]/signer) */
export async function signConventionPublicAction(
  token: string,
  data: { nom: string; signatureDataUrl: string },
  meta: { ip?: string; userAgent?: string },
): Promise<ActionResult> {
  if (!data.nom?.trim()) return { success: false, error: 'Nom requis pour la signature' }
  if (!data.signatureDataUrl?.startsWith('data:image/')) {
    return { success: false, error: 'Signature manquante' }
  }

  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select('id, organization_id, signature_token_expires_at, status, session_id, client_id, formation_id')
    .eq('signature_token', token)
    .single()
  if (!conv) return { success: false, error: 'Lien invalide' }
  if (conv.signature_token_expires_at && new Date(conv.signature_token_expires_at) < new Date()) {
    return { success: false, error: 'Lien expiré' }
  }
  if (['signee_client', 'signee_complete'].includes(conv.status)) {
    return { success: false, error: 'Convention déjà signée' }
  }

  const now = new Date().toISOString()

  // La date PORTÉE sur la convention précède toujours le début de la session :
  // si la signature arrive le jour J ou après (relance d'un client qui n'avait
  // jamais signé), elle est datée de la veille du début — l'accord était
  // antérieur à la formation, seul le clic est tardif. L'horodatage réel
  // (IP, user-agent, updated_at) garde la trace de la signature effective.
  let datePortee = now
  if (conv.session_id) {
    const { data: sess } = await supabase.from('sessions').select('date_debut').eq('id', conv.session_id).maybeSingle()
    if (sess?.date_debut && now.slice(0, 10) >= String(sess.date_debut).slice(0, 10)) {
      const j1 = new Date(sess.date_debut)
      j1.setDate(j1.getDate() - 1)
      datePortee = `${j1.toISOString().slice(0, 10)}T${now.slice(11)}`
    }
  }

  // ── Auto-apposition du tampon OF comme signature ──
  const { data: org } = await supabase
    .from('organizations')
    .select('tampon_signature_url, representant_legal_prenom, representant_legal_nom, representant_legal_fonction')
    .eq('id', conv.organization_id)
    .single()

  const ofSignatureData = org?.tampon_signature_url || null
  const ofSignatureNom = org
    ? [org.representant_legal_prenom, org.representant_legal_nom].filter(Boolean).join(' ')
        + (org.representant_legal_fonction ? `, ${org.representant_legal_fonction}` : '')
    : null

  // Statut final : signee_complete si OF auto-signé via tampon, sinon signee_client
  const newStatus = ofSignatureData ? 'signee_complete' : 'signee_client'

  await supabase
    .from('conventions')
    .update({
      status: newStatus,
      signature_client_date: datePortee,
      signature_client_nom: data.nom.trim(),
      signature_client_signature_data: data.signatureDataUrl,
      signature_client_ip: meta.ip || null,
      signature_client_user_agent: meta.userAgent || null,
      // Auto-signature OF si tampon configuré
      signature_of_date: ofSignatureData ? datePortee : null,
      signature_of_nom: ofSignatureData ? ofSignatureNom : null,
      // À la signature client → la demande AKTO peut être envoyée
      akto_dossier_status: conv.client_id ? 'pret_a_envoyer' : 'non_envoye',
    })
    .eq('id', conv.id)

  // Si la convention est liée à une session → bascule en 'validee' si contrat formateur OK
  if (conv.session_id) {
    const { maybeValidateSession } = await import('@/app/dashboard/sessions/confirm-actions')
    await maybeValidateSession(supabase, conv.session_id, conv.organization_id)
  }

  // Notifier le créateur de la convention
  const { createNotification } = await import('@/lib/email')
  const { data: createdBy } = await supabase
    .from('conventions').select('created_by').eq('id', conv.id).single()
  if (createdBy?.created_by) {
    await createNotification({
      organizationId: conv.organization_id,
      userId: createdBy.created_by,
      titre: 'Convention signée par le client',
      message: `${data.nom.trim()} a signé la convention. Vous pouvez maintenant envoyer la demande de prise en charge AKTO.`,
      type: 'convention',
      lienUrl: `/dashboard/conventions`,
      lienLabel: 'Voir la convention',
      entityType: 'convention',
      entityId: conv.id,
    })
  }

  // Email avec convention signée (copie PDF) → client + équipe (si signature complète des deux côtés)
  if (newStatus === 'signee_complete') {
    try {
      const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
      const loaded = await loadConventionForPdf(supabase, conv.id)
      const convFull: any = loaded?.convention
      const orgFull: any = loaded?.org
      const cli: any = convFull?.client
      const toEmails: string[] = []
      if (cli?.email) toEmails.push(cli.email)
      // copie OF (créateur ou email contact)
      const orgEmail = (orgFull as any)?.email_contact || orgFull?.email
      if (orgEmail && !toEmails.includes(orgEmail)) toEmails.push(orgEmail)

      if (convFull && toEmails.length > 0) {
        const { renderToBuffer } = await import('@react-pdf/renderer')
        const { createElement } = await import('react')
        const { ConventionPDF } = await import('@/lib/pdf/convention-pdf')
        const buffer = await renderToBuffer(createElement(ConventionPDF, { convention: convFull as any, org: orgFull }) as any)

        const { sendDocumentEmail } = await import('@/lib/email')
        const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('fr-FR') : '—'
        await sendDocumentEmail({
          to: toEmails,
          orgName: orgFull?.name || 'Lab Learning',
          orgEmail,
          orgLogoUrl: (await (await import('@/lib/pdf/org-logo')).resolveEmailLogoUrl(supabase, orgFull)) || undefined,
          qualiopiCertified: (orgFull as any)?.is_qualiopi !== false,
          recipientName: cli?.raison_sociale || 'Madame, Monsieur',
          subject: `Convention ${(convFull as any).numero} signée — copie exécutée`,
          docTitle: 'Convention signée — copie pour vos dossiers',
          intro: `La convention de formation a été signée par les deux parties. Vous trouverez ci-joint l'exemplaire signé exécutoire.`,
          metadata: [
            ['Référence', (convFull as any).numero || ''],
            ['Formation', (convFull as any).formation?.intitule || '—'],
            ['Signée le', fmtDate((convFull as any).signature_client_date)],
          ],
          pdfBuffer: Buffer.from(buffer),
          pdfFilename: `convention-${(convFull as any).numero}-signee.pdf`,
          footerNote: 'Cet exemplaire fait foi entre les parties. Conservez-le pour vos archives.',
          organizationId: (conv as any).organization_id,
          entityType: 'convention',
          entityId: conv.id,
        })
      }
    } catch (e) { console.error('[email conv signee]', e) }
  }

  await logAudit({ action: 'sign_convention', entity_type: 'convention', entity_id: conv.id, details: { signataire: data.nom } })
  return { success: true, data: { conventionId: conv.id } }
}

/** Marque la demande AKTO comme envoyée et permet de saisir le numéro de dossier reçu */
export async function updateAktoStatusAction(
  conventionId: string,
  status: 'envoye' | 'accord_recu' | 'refuse',
  numero?: string,
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const update: Record<string, unknown> = { akto_dossier_status: status }
  if (status === 'envoye') update.akto_dossier_envoye_at = new Date().toISOString()
  if (status === 'accord_recu') {
    update.akto_accord_recu_at = new Date().toISOString()
    if (numero) update.akto_dossier_numero = numero
  }

  const { error } = await supabase
    .from('conventions')
    .update(update)
    .eq('id', conventionId)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: `akto_${status}`, entity_type: 'convention', entity_id: conventionId, details: { numero } })
  revalidatePath('/dashboard/conventions')
  return { success: true }
}
