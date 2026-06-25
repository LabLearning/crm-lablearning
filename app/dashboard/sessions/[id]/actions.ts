'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

export async function updateSessionStatusAction(sessionId: string, newStatus: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('sessions')
    .update({ status: newStatus })
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
    const tarifBase = sess.type_session === 'intra' ? formation?.tarif_intra_ht : formation?.tarif_inter_ht
    const montantHt = tarifBase ? tarifBase * (nbApprenants || 1) : null
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
      taux_tva: 20,
      montant_ttc: montantHt ? montantHt * 1.2 : null,
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
      await sendDocumentEmail({
        to: toEmail,
        orgName: orgFull?.name || 'Lab Learning',
        orgEmail: orgFull?.email_contact || orgFull?.email,
        orgLogoUrl: orgFull?.logo_url,
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
    .select('*, formation:formations(intitule, duree_heures), formateur:formateurs(id)')
    .eq('id', sessionId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!sess) return { success: false, error: 'Session introuvable' }
  const formateurId = (sess as any).formateur?.id || sess.formateur_id
  if (!formateurId) return { success: false, error: 'Aucun formateur rattaché à la session' }

  const { data: formateur } = await supabase.from('formateurs').select('*').eq('id', formateurId).single()
  if (!formateur) return { success: false, error: 'Formateur introuvable' }
  if (!formateur.email) return { success: false, error: "Le formateur n'a pas d'adresse email renseignée" }

  try {
    const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', sess.organization_id).single()
    const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
    const org = await withDocumentLogo(supabase, orgRaw)

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { ContratFormateurPDF } = await import('@/lib/pdf/contrat-formateur-pdf')
    const buffer = await renderToBuffer(createElement(ContratFormateurPDF, { formateur, org, session: sess }) as any)

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
