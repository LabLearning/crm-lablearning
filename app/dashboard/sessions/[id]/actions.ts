'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

export async function updateSessionStatusAction(sessionId: string, newStatus: string, coutFormateur?: number | null): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // À la validation de la session, le montant formateur négocié est figé sur la session
  // (le tarif de la fiche formateur n'est qu'indicatif et peut changer jusqu'au dernier moment)
  const updateData: Record<string, unknown> = { status: newStatus }
  if (coutFormateur != null && Number.isFinite(Number(coutFormateur))) {
    updateData.cout_formateur = Number(coutFormateur)
  }

  const { error } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: error.message }

  // Quand la session est marquée terminée : email d'évaluation au commanditaire (Qualiopi Ind. 28)
  if (newStatus === 'terminee') {
    try {
      const { data: sess } = await supabase
        .from('sessions')
        .select(`
          id, date_debut, date_fin,
          formation:formation_id(intitule),
          client:client_id(raison_sociale, email)
        `)
        .eq('id', sessionId)
        .single()
      const cli: any = (sess as any)?.client
      if (cli?.email) {
        const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
        const { sendDocumentEmail } = await import('@/lib/email')
        const formationNom = (sess as any).formation?.intitule || 'Formation'
        const periode = sess?.date_debut
          ? `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin || sess.date_debut).toLocaleDateString('fr-FR')}`
          : '—'
        const replyEmail = (org as any)?.email_contact || org?.email
        await sendDocumentEmail({
          to: cli.email,
          orgName: org?.name || 'Lab Learning',
          orgEmail: replyEmail,
          orgLogoUrl: (org as any)?.logo_url,
          qualiopiCertified: (org as any)?.is_qualiopi !== false,
          recipientName: cli.raison_sociale || 'Madame, Monsieur',
          subject: `Votre avis sur la formation — ${formationNom}`,
          docTitle: 'Donnez-nous votre avis (commanditaire)',
          intro: `La formation que vous nous avez confiée pour vos collaborateurs vient de se terminer. Votre retour en tant que commanditaire est essentiel à notre démarche qualité (indicateur Qualiopi 28).`,
          metadata: [
            ['Formation', formationNom],
            ['Période', periode],
          ],
          ctaLabel: 'Répondre par email',
          ctaUrl: replyEmail ? `mailto:${replyEmail}?subject=${encodeURIComponent('Retour formation — ' + formationNom)}` : undefined,
          footerNote: 'Vos remarques nous aident à améliorer continuellement nos prestations.',
        })
      }
    } catch (e) { console.error('[email eval client]', e) }
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

export async function togglePresenceAction(emargementId: string, estPresent: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('emargements')
    .update({ est_present: estPresent })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function signEmargementAction(emargementId: string, signatureBase64: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Récupérer l'émargement pour avoir le contexte
  const { data: emargement } = await supabase
    .from('emargements')
    .select('id, session_id, apprenant_id')
    .eq('id', emargementId)
    .single()

  if (!emargement) return { success: false, error: 'Émargement introuvable' }

  // Upload de la signature
  let signatureUrl: string | null = null
  if (signatureBase64.startsWith('data:image/')) {
    const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `${session.organization.id}/${emargement.session_id}/${emargement.apprenant_id}_${Date.now()}.png`

    const { error: uploadErr } = await supabase.storage
      .from('pointages')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('pointages').getPublicUrl(path)
      signatureUrl = urlData?.publicUrl || null
    }
  }

  // Mettre à jour l'émargement : présent + signature + heure
  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: true,
      signature_data: signatureUrl,
      signed_at: new Date().toISOString(),
    })
    .eq('id', emargementId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/sessions')
  return { success: true }
}

export async function createEmargementJourAction(sessionId: string, date: string, creneau: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Récupérer les apprenants inscrits
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  if (!inscriptions || inscriptions.length === 0) {
    return { success: false, error: 'Aucun apprenant inscrit' }
  }

  // Vérifier les doublons
  const apprenantIds = inscriptions.map(i => i.apprenant_id)
  const { data: existing } = await supabase
    .from('emargements')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .eq('date', date)
    .eq('creneau', creneau)
    .in('apprenant_id', apprenantIds)

  const existingIds = new Set((existing || []).map((e: any) => e.apprenant_id))

  const toInsert = inscriptions
    .filter(i => !existingIds.has(i.apprenant_id))
    .map(i => ({
      session_id: sessionId,
      apprenant_id: i.apprenant_id,
      date,
      creneau,
      est_present: false,
      organization_id: session.organization.id,
    }))

  if (toInsert.length === 0) {
    return { success: false, error: 'Feuille d\'émargement déjà créée pour ce jour' }
  }

  const { error } = await supabase.from('emargements').insert(toInsert)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

/**
 * Rattache un QCM de la banque à une session et sème une réponse (qcm_reponses)
 * pour chaque apprenant inscrit, afin qu'il apparaisse dans leur portail.
 * Réutilise la logique idempotente de lib/qcm-auto-seed.
 */
export async function attachQcmToSessionAction(sessionId: string, qcmId: string): Promise<ActionResult & { data?: { created: number } }> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  // La session doit appartenir à l'organisation
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id')
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
    .maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  // Le QCM doit appartenir à l'organisation
  const { data: qcm } = await supabase
    .from('qcm')
    .select('id')
    .eq('id', qcmId)
    .eq('organization_id', session.organization.id)
    .maybeSingle()
  if (!qcm) return { success: false, error: 'QCM introuvable' }

  // Créer le rattachement qcm_sessions s'il n'existe pas déjà
  const { data: existingQs } = await supabase
    .from('qcm_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('qcm_id', qcmId)
    .eq('organization_id', session.organization.id)
    .maybeSingle()

  let qcmSessionId = existingQs?.id as string | undefined
  if (!qcmSessionId) {
    const { data: createdQs, error: qsErr } = await supabase
      .from('qcm_sessions')
      .insert({
        organization_id: session.organization.id,
        qcm_id: qcmId,
        session_id: sessionId,
        date_ouverture: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (qsErr || !createdQs) return { success: false, error: 'Impossible de rattacher le QCM' }
    qcmSessionId = createdQs.id
  }

  // Semer les réponses pour les apprenants inscrits
  const { seedQcmReponsesForQcm } = await import('@/lib/qcm-auto-seed')
  const res = await seedQcmReponsesForQcm(supabase, sessionId, qcmId, qcmSessionId)

  await logAudit({ action: 'attach_qcm_session', entity_type: 'session', entity_id: sessionId, details: { qcmId, created: res.created } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { created: res.created } }
}

const fmtFr = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('fr-FR') : '—')

/**
 * Envoie la convention de formation au client pour signature électronique.
 * Crée la convention si elle n'existe pas encore pour la session, génère le lien
 * de signature, et envoie un email brandé avec le PDF + le lien « Signer en ligne ».
 */
export async function sendConventionForSignatureAction(
  sessionId: string,
  conventionId?: string,
): Promise<ActionResult & { data?: { url: string; email?: string } }> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Session + formation
  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(intitule, duree_heures, tarif_intra_ht, tarif_inter_ht)')
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!sess.client_id) return { success: false, error: 'Aucun client entreprise rattaché à la session' }

  // Convention liée (ou création)
  let convId = conventionId
  if (!convId) {
    const { data: existing } = await supabase
      .from('conventions')
      .select('id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    convId = existing?.id
  }
  if (!convId) {
    const { count: nbApprenants } = await supabase
      .from('inscriptions').select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')
    const { count: convCount } = await supabase
      .from('conventions').select('*', { count: 'exact', head: true })
      .eq('organization_id', sess.organization_id)
    const numero = `CV-${new Date().getFullYear()}-${String((convCount || 0) + 1).padStart(3, '0')}`
    const formation = (sess as any).formation
    // Le prix saisi sur la session fait foi ; sinon repli sur le tarif catalogue
    const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
    const montantHt = (sess as any).prix_ht != null
      ? Number((sess as any).prix_ht)
      : (tarifBase ? tarifBase * (nbApprenants || 1) : null)
    const { data: created, error: createErr } = await supabase.from('conventions').insert({
      organization_id: sess.organization_id,
      numero,
      type: sess.type_session === 'intra' ? 'intra_entreprise' : 'inter_entreprise',
      session_id: sessionId,
      client_id: sess.client_id,
      formation_id: sess.formation_id,
      status: 'brouillon',
      objet: `Convention de formation — ${formation?.intitule || 'Formation'}`,
      nombre_stagiaires: nbApprenants || 0,
      duree_heures: formation?.duree_heures || null,
      lieu: sess.lieu || null,
      dates_formation: `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`,
      montant_ht: montantHt,
      // Organisme de formation exonéré de TVA (art. 261-4-4° a du CGI)
      taux_tva: 0,
      montant_ttc: montantHt,
      created_by: session.user.id,
    }).select('id').single()
    if (createErr || !created) return { success: false, error: 'Impossible de créer la convention' }
    convId = created.id
  }

  // Lien de signature
  const { generateSignatureLinkAction } = await import('@/app/dashboard/conventions/signature-actions')
  const link = await generateSignatureLinkAction(convId)
  if (!link.success || !link.data?.url) return { success: false, error: link.error || 'Erreur lien de signature' }
  const url = (link.data as any).url as string

  // Email destinataire : email client, sinon premier contact
  const { data: client } = await supabase
    .from('clients').select('id, raison_sociale, email').eq('id', sess.client_id).single()
  let toEmail: string | null = client?.email || null
  let toName = client?.raison_sociale || 'Madame, Monsieur'
  if (!toEmail) {
    const { data: contact } = await supabase
      .from('contacts').select('prenom, nom, email').eq('client_id', sess.client_id)
      .not('email', 'is', null).limit(1).maybeSingle()
    if (contact?.email) {
      toEmail = contact.email
      toName = [contact.prenom, contact.nom].filter(Boolean).join(' ') || toName
    }
  }

  // PDF convention + email
  try {
    const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
    const loaded = await loadConventionForPdf(supabase, convId)
    const convFull: any = loaded?.convention
    const orgFull: any = loaded?.org

    if (toEmail && convFull) {
      const { renderToBuffer } = await import('@react-pdf/renderer')
      const { createElement } = await import('react')
      const { ConventionPDF } = await import('@/lib/pdf/convention-pdf')
      const buffer = await renderToBuffer(createElement(ConventionPDF, { convention: convFull, org: orgFull }) as any)

      const { sendDocumentEmail } = await import('@/lib/email')
      // orgFull porte le logo des PDF (vert) : pour l'email il faut le logo clair
      const { resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
      const emailLogo = await resolveEmailLogoUrl(supabase, orgFull)
      await sendDocumentEmail({
        to: toEmail,
        orgName: orgFull?.name || 'Lab Learning',
        orgEmail: orgFull?.email_contact || orgFull?.email,
        orgLogoUrl: emailLogo || undefined,
        qualiopiCertified: orgFull?.is_qualiopi !== false,
        recipientName: toName,
        subject: `Convention de formation ${convFull.numero} — signature requise`,
        docTitle: 'Convention de formation à signer',
        intro: `Veuillez trouver ci-joint la convention de formation. Vous pouvez la signer en ligne en quelques secondes via le bouton ci-dessous ; un exemplaire signé vous sera ensuite transmis automatiquement.`,
        metadata: [
          ['Référence', convFull.numero || ''],
          ['Formation', convFull.formation?.intitule || (sess as any).formation?.intitule || '—'],
          ['Dates', convFull.dates_formation || `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`],
          ...(convFull.montant_ttc ? [['Montant TTC', `${Number(convFull.montant_ttc).toLocaleString('fr-FR')} €`] as [string, string]] : []),
        ],
        ctaLabel: 'Signer la convention en ligne',
        ctaUrl: url,
        pdfBuffer: Buffer.from(buffer),
        pdfFilename: `convention-${convFull.numero}.pdf`,
        footerNote: 'Lien valable 30 jours. Vous pouvez aussi signer le PDF et nous le retourner.',
      })
    }
  } catch (e) { console.error('[send convention signature]', e) }

  await logAudit({ action: 'send_convention_signature', entity_type: 'convention', entity_id: convId, details: { sessionId } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  revalidatePath('/dashboard/conventions')

  if (!toEmail) {
    return { success: true, warning: "Convention prête à signer, mais aucun email client trouvé — copiez le lien ci-dessous.", data: { url } }
  }
  return { success: true, data: { url, email: toEmail } }
}

/**
 * Envoie le contrat de prestation au formateur de la session, par email, avec
 * le PDF pré-rempli (formation, dates, lieu, durée, parties).
 */
export async function sendContratToFormateurAction(sessionId: string): Promise<ActionResult & { data?: { email: string } }> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(intitule, duree_heures), formateur:formateurs(id)')
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!sess) return { success: false, error: 'Session introuvable' }
  const formateurId = (sess as any).formateur?.id || sess.formateur_id
  if (!formateurId) return { success: false, error: 'Aucun formateur rattaché à la session' }

  const { data: formateur } = await supabase.from('formateurs').select('*').eq('id', formateurId).single()
  if (!formateur) return { success: false, error: 'Formateur introuvable' }
  if (!formateur.email) return { success: false, error: "Le formateur n'a pas d'adresse email renseignée" }

  // On envoie une VRAIE demande de signature (lien tokenisé). Si aucun contrat
  // n'existe encore (formateur pas encore passé par l'acceptation), on le crée
  // à la volée : sans ça l'envoi ne faisait qu'expédier un PDF statique et
  // l'état restait « non envoyé ».
  const { data: contratExistant } = await supabase
    .from('contrats_formateur')
    .select('id, signature_formateur_date')
    .eq('session_id', sessionId)
    .neq('status', 'annule')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const dejaSigne = !!contratExistant?.signature_formateur_date
  if (!dejaSigne) {
    const { ensureContratFormateur, sendContratForSignature } = await import('@/lib/contrat-formateur')
    const cid = contratExistant?.id
      ? { id: contratExistant.id }
      : await ensureContratFormateur(supabase, sessionId, session.user.id)
    if (!cid) return { success: false, error: 'Impossible de préparer le contrat' }
    const r = await sendContratForSignature(supabase, cid.id)
    if (!r.success) return { success: false, error: r.error }
    await logAudit({ action: 'send_contrat_signature', entity_type: 'contrat_formateur', entity_id: cid.id, details: { sessionId } })
    revalidatePath(`/dashboard/sessions/${sessionId}`)
    return { success: true, data: { email: formateur.email } }
  }

  // Contrat déjà signé, ou pas encore créé : envoi d'une copie PDF pour information
  try {
    const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()
    const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
    const org = await withDocumentLogo(supabase, orgRaw)

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { ContratFormateurPDF } = await import('@/lib/pdf/contrat-formateur-pdf')
    // Contrat signé : le PDF doit porter les signatures, pas des cadres vides
    const { data: contratFull } = contratExistant
      ? await supabase.from('contrats_formateur').select('*').eq('id', contratExistant.id).single()
      : { data: null }
    const buffer = await renderToBuffer(
      createElement(ContratFormateurPDF, { formateur, org, session: sess, contrat: contratFull }) as any,
    )

    const { sendDocumentEmail } = await import('@/lib/email')
    const formationNom = (sess as any).formation?.intitule || 'Formation'
    await sendDocumentEmail({
      to: formateur.email,
      orgName: (orgRaw as any)?.name || 'Lab Learning',
      orgEmail: (orgRaw as any)?.email_contact || (orgRaw as any)?.email,
      orgLogoUrl: (orgRaw as any)?.logo_url,
      qualiopiCertified: (orgRaw as any)?.is_qualiopi !== false,
      recipientName: `${formateur.prenom} ${formateur.nom}`,
      subject: `Contrat de prestation — ${formationNom}`,
      docTitle: 'Votre contrat de prestation de formation',
      intro: `Voici votre contrat de prestation pour la session que vous allez animer. Merci de le conserver ; il reprend l'ensemble des informations de la mission.`,
      metadata: [
        ['Formation', formationNom],
        ['Dates', `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`],
        ['Durée', (sess as any).formation?.duree_heures ? `${(sess as any).formation.duree_heures} h` : '—'],
        ['Lieu', sess.lieu || 'Distanciel'],
      ],
      pdfBuffer: Buffer.from(buffer),
      pdfFilename: `contrat-prestation-${formateur.nom}.pdf`,
      footerNote: 'Document contractuel — à conserver pour vos dossiers.',
    })
  } catch (e) {
    console.error('[send contrat formateur]', e)
    return { success: false, error: "Échec de l'envoi du contrat" }
  }

  await logAudit({ action: 'send_contrat_formateur', entity_type: 'formateur', entity_id: formateurId, details: { sessionId } })
  return { success: true, data: { email: formateur.email } }
}

// ============================================================
// Contenu pédagogique de la session
// ============================================================

const VISIBILITES = ['formateur', 'stagiaires', 'tous']

/** Déroulé pédagogique + matériel nécessaire, saisis depuis la fiche session */
export async function updateDeroulePedagogiqueAction(
  sessionId: string,
  deroule: string,
  materiel: string,
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      deroule_pedagogique: deroule.trim() || null,
      materiel_necessaire: materiel.trim() || null,
    })
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de l\'enregistrement' }

  await logAudit({ action: 'update_deroule_pedagogique', entity_type: 'session', entity_id: sessionId })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

/** Rattache un support pédagogique téléversé à la session */
export async function addSessionSupportAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const sessionId = formData.get('session_id') as string
  const nom = ((formData.get('nom') as string) || '').trim()
  const type = (formData.get('type') as string) || 'support_pedagogique'
  const visibilite = (formData.get('visibilite') as string) || 'formateur'
  const storagePath = (formData.get('storage_path') as string) || null

  if (!sessionId) return { success: false, error: 'Session manquante' }
  if (!nom) return { success: false, error: 'Donnez un nom au support' }
  if (!storagePath) return { success: false, error: 'Fichier manquant' }
  if (!VISIBILITES.includes(visibilite)) return { success: false, error: 'Visibilité invalide' }

  // La session doit appartenir à l'organisation de l'utilisateur
  const { data: sess } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
    .maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const fileSize = formData.get('file_size')
  const { data, error } = await supabase.from('documents').insert({
    organization_id: session.organization.id,
    nom,
    type,
    visibilite,
    session_id: sessionId,
    description: ((formData.get('description') as string) || '').trim() || null,
    storage_path: storagePath,
    file_name: (formData.get('file_name') as string) || null,
    file_size: fileSize ? Number(fileSize) : null,
    mime_type: (formData.get('mime_type') as string) || null,
    created_by: session.user.id,
  }).select('id').single()

  if (error) return { success: false, error: 'Erreur lors de l\'enregistrement' }

  await logAudit({ action: 'create', entity_type: 'document', entity_id: data.id, details: { sessionId, visibilite } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

/** Change la visibilité d'un support (formateur / stagiaires / tous) */
export async function updateSupportVisibiliteAction(
  documentId: string,
  visibilite: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!VISIBILITES.includes(visibilite)) return { success: false, error: 'Visibilité invalide' }
  const supabase = await createServiceRoleClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, session_id')
    .eq('id', documentId)
    .eq('organization_id', session.organization.id)
    .maybeSingle()
  if (!doc) return { success: false, error: 'Document introuvable' }

  const { error } = await supabase.from('documents').update({ visibilite }).eq('id', documentId)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update_visibilite', entity_type: 'document', entity_id: documentId, details: { visibilite } })
  if (doc.session_id) revalidatePath(`/dashboard/sessions/${doc.session_id}`)
  return { success: true }
}

/** Supprime un support pédagogique (base + fichier stocké) */
export async function deleteSessionSupportAction(documentId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, session_id, storage_path')
    .eq('id', documentId)
    .eq('organization_id', session.organization.id)
    .maybeSingle()
  if (!doc) return { success: false, error: 'Document introuvable' }

  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error) return { success: false, error: 'Erreur lors de la suppression' }
  if (doc.storage_path) {
    await supabase.storage.from('documents').remove([doc.storage_path])
  }

  await logAudit({ action: 'delete', entity_type: 'document', entity_id: documentId })
  if (doc.session_id) revalidatePath(`/dashboard/sessions/${doc.session_id}`)
  return { success: true }
}

/** Modifie la rémunération du formateur depuis la fiche session */
export async function updateCoutFormateurAction(sessionId: string, montant: number | null): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({ cout_formateur: montant })
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  // Répercute sur le contrat tant qu'il n'est pas signé
  const { data: contrat } = await supabase
    .from('contrats_formateur')
    .select('id, status, signature_formateur_date')
    .eq('session_id', sessionId)
    .neq('status', 'annule')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (contrat && !contrat.signature_formateur_date && contrat.status !== 'signe_formateur') {
    await supabase.from('contrats_formateur').update({ montant_ht: montant }).eq('id', contrat.id)
  }

  await logAudit({ action: 'update_cout_formateur', entity_type: 'session', entity_id: sessionId, details: { montant } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { contratMisAJour: !!contrat && !contrat.signature_formateur_date } }
}

/**
 * Prix de vente HT de la session (celui qui figure sur la convention).
 * Modifiable directement depuis la fiche session ; répercuté sur la convention
 * liée tant qu'elle est en brouillon. Organisme exonéré de TVA → TTC = HT.
 */
export async function updateSessionPrixAction(sessionId: string, montant: number | null): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({ prix_ht: montant })
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  let conventionMaj = false
  if (montant != null) {
    const { data: conv } = await supabase
      .from('conventions')
      .update({ montant_ht: montant, montant_ttc: montant, taux_tva: 0 })
      .eq('session_id', sessionId)
      .eq('organization_id', session.organization.id)
      .eq('status', 'brouillon')
      .select('id')
    conventionMaj = !!(conv && conv.length)
  }

  await logAudit({ action: 'update_prix_session', entity_type: 'session', entity_id: sessionId, details: { montant } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { conventionMaj } }
}

/**
 * Recherche d'apprenants pour les ajouter à une session, par nom, prénom,
 * email ou entreprise. Scopée à l'organisation. Les apprenants déjà inscrits
 * à la session sont marqués (dejaInscrit) plutôt qu'exclus, pour le feedback.
 */
export async function searchApprenantsForSessionAction(
  sessionId: string,
  query: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const q = (query || '').trim()
  if (q.length < 2) return { success: true, data: [] }
  const supabase = await createServiceRoleClient()

  const like = `%${q}%`
  const { data, error } = await supabase
    .from('apprenants')
    .select('id, prenom, nom, email, entreprise, client:clients(raison_sociale)')
    .eq('organization_id', session.organization.id)
    .or(`prenom.ilike.${like},nom.ilike.${like},email.ilike.${like},entreprise.ilike.${like}`)
    .order('nom', { ascending: true })
    .limit(20)
  if (error) return { success: false, error: 'Erreur de recherche' }

  const { data: inscrits } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')
  const inscritsSet = new Set((inscrits || []).map((i: any) => i.apprenant_id))

  const results = (data || []).map((a: any) => ({
    id: a.id, prenom: a.prenom, nom: a.nom, email: a.email,
    entreprise: a.entreprise || a.client?.raison_sociale || null,
    dejaInscrit: inscritsSet.has(a.id),
  }))
  return { success: true, data: results }
}

/**
 * Retire un apprenant d'une session (désinscription). L'inscription est
 * marquée « annule » plutôt que supprimée, pour conserver l'historique.
 */
export async function desinscrireApprenantAction(
  sessionId: string,
  apprenantId: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('inscriptions')
    .update({ status: 'annule' })
    .eq('session_id', sessionId)
    .eq('apprenant_id', apprenantId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors du retrait' }

  await logAudit({ action: 'desinscription', entity_type: 'session', entity_id: sessionId, details: { apprenant_id: apprenantId } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}
