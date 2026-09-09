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
  // + envoi AUTOMATIQUE des attestations d'hygiène et du diplôme d'établissement
  if (newStatus === 'terminee') {
    try {
      const { envoyerHygieneAutomatique } = await import('@/lib/hygiene-auto')
      await envoyerHygieneAutomatique(supabase, sessionId, session.organization.id)
    }
    catch (e: any) { console.error('[hygiene auto]', e?.message) }
  }
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
          organizationId: session.organization.id,
          entityType: 'session',
          entityId: sessionId,
          triggeredBy: session.user.id,
        })
      }
    } catch (e) { console.error('[email eval client]', e) }
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

export async function togglePresenceAction(
  emargementId: string,
  estPresent: boolean | null,
  motifAbsence?: string | null,
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Scope organisation + récupère la session pour revalider la BONNE page
  const { data: em } = await supabase.from('emargements')
    .select('id, session_id, session:session_id(organization_id)')
    .eq('id', emargementId).maybeSingle()
  if (!em || (em as any).session?.organization_id !== session.organization.id) {
    return { success: false, error: 'Émargement introuvable' }
  }

  const { error } = await supabase
    .from('emargements')
    .update({
      est_present: estPresent,
      motif_absence: estPresent === false ? (motifAbsence ?? null) : null,
    })
    .eq('id', emargementId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/sessions/${em.session_id}`)
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

  revalidatePath(`/dashboard/sessions/${(emargement as any)?.session_id || ''}`)
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
  /** lienSeul : prépare la convention et son lien de signature SANS envoyer d'email. */
  opts?: { lienSeul?: boolean },
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

  // L'analyse du besoin précède la contractualisation (indicateur 4 du RNQ) :
  // une convention partie avant le recueil produit un dossier dont les dates
  // se contredisent — c'est exactement l'écart relevé à l'audit blanc sur
  // 7 conventions. On bloque à la source plutôt que de réparer après coup.
  const { data: recueil } = await supabase
    .from('recueils_besoin')
    .select('id, statut, date_recueil')
    .eq('session_id', sessionId)
    .eq('statut', 'complete')
    .limit(1)
    .maybeSingle()
  if (!recueil) {
    return {
      success: false,
      error: "Complétez d'abord le recueil du besoin (onglet Recueil) : l'analyse du besoin doit être datée avant la signature de la convention (indicateur 4).",
    }
  }

  // Pas de verrou sur la date de session : une convention doit pouvoir être
  // renvoyée même après la fin de la formation (avenant, régularisation,
  // relance d'un client qui n'a jamais signé). Seul le recueil complété
  // conditionne l'envoi.

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

  // Re-synchronise le snapshot dates/lieu depuis la session courante avant
  // (re)génération du lien : sinon un changement de dates de session n'était pas
  // repris dans la convention envoyée en signature. On ne touche pas une
  // convention déjà signée.
  {
    const { data: conv } = await supabase
      .from('conventions').select('status, signature_client_date').eq('id', convId).single()
    if (conv && !conv.signature_client_date && conv.status !== 'signee') {
      await supabase.from('conventions').update({
        dates_formation: `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`,
        lieu: sess.lieu || null,
      }).eq('id', convId).eq('organization_id', session.organization.id)
    }
  }

  // Lien de signature
  const { generateSignatureLinkAction } = await import('@/app/dashboard/conventions/signature-actions')
  const link = await generateSignatureLinkAction(convId)
  if (!link.success || !link.data?.url) return { success: false, error: link.error || 'Erreur lien de signature' }
  const url = (link.data as any).url as string

  // Lien seul : la convention est prête et son lien valide, mais rien ne part
  // (le gestionnaire le transmet lui-même : WhatsApp, autre adresse, en main propre).
  if (opts?.lienSeul) {
    revalidatePath(`/dashboard/sessions/${sessionId}`)
    revalidatePath('/dashboard/conventions')
    return { success: true, data: { url } }
  }

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
        organizationId: sess.organization_id,
        entityType: 'convention',
        entityId: convId,
        triggeredBy: session.user.id,
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
    .select('*, formation:formation_id(intitule, duree_heures, reference, sous_titre, objectifs_pedagogiques, programme_detaille, prerequis, public_vise, methodes_pedagogiques, moyens_techniques, modalites_evaluation), formateur:formateurs(id)')
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
      organizationId: sess.organization_id,
      entityType: 'contrat_formateur',
      entityId: contratExistant?.id || sessionId,
      triggeredBy: session.user.id,
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
 * Apprenants rattachés à l'entreprise (client) de la session, avec le marqueur
 * `dejaInscrit`. Permet d'inscrire en un clic les apprenants du client sans
 * avoir à les rechercher par nom.
 */
export async function getClientApprenantsForSessionAction(
  sessionId: string,
  clientId: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  if (!clientId) return { success: true, data: [] }
  const supabase = await createServiceRoleClient()

  const { data } = await supabase
    .from('apprenants')
    .select('id, prenom, nom, email, entreprise, client:clients(raison_sociale)')
    .eq('organization_id', session.organization.id)
    .eq('client_id', clientId)
    .order('nom', { ascending: true })

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

/**
 * Envoie au formateur, avant la formation, un email récapitulatif de la session :
 * formation, dates/horaires, lieu complet, établissement + contact sur place,
 * nombre de stagiaires, et le lien vers son espace formateur.
 */
export async function sendSessionInfoToFormateurAction(sessionId: string, opts?: { preview?: boolean }): Promise<ActionResult & { data?: { email?: string; html?: string; subject?: string } }> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(intitule, duree_heures), formateur:formateurs(id, prenom, nom, email, user_id), client:client_id(id, raison_sociale, adresse, code_postal, ville, telephone, email)')
    .eq('id', sessionId).eq('organization_id', session.organization.id).single()
  if (!sess) return { success: false, error: 'Session introuvable' }
  const formateur = (sess as any).formateur
  if (!formateur?.email) return { success: false, error: "Le formateur n'a pas d'adresse email renseignée" }

  // Contact référent du client (fiche contact sur place)
  let contactLine = ''
  if (sess.client_id) {
    const { data: contacts } = await supabase
      .from('contacts').select('prenom, nom, poste, telephone, mobile, email, est_signataire, est_principal')
      .eq('client_id', sess.client_id)
    const list = (contacts || []) as any[]
    const c = list.find((x) => x.est_signataire) || list.find((x) => x.est_principal) || list[0]
    if (c) contactLine = [
      `${c.prenom || ''} ${c.nom || ''}`.trim() + (c.poste ? ` (${c.poste})` : ''),
      c.telephone || c.mobile, c.email,
    ].filter(Boolean).join(' · ')
  }

  const cli = (sess as any).client
  const lieu = [sess.lieu, sess.adresse, [sess.code_postal, sess.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    || [cli?.raison_sociale, cli?.adresse, [cli?.code_postal, cli?.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    || '—'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  let spaceUrl = `${appUrl}/mon-espace`
  try {
    const { getFormateurPortalToken } = await import('@/lib/formateur-portal')
    const token = await getFormateurPortalToken(supabase, session.organization.id, formateur.user_id, formateur.email)
    if (token) spaceUrl = `${appUrl}/portail/${token}`
  } catch (e) { console.error('[infos session formateur — token]', e) }

  const { count: nbApprenants } = await supabase
    .from('inscriptions').select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')

  const { data: org } = await supabase
    .from('organizations').select('name, email, email_contact, logo_url, is_qualiopi').eq('id', session.organization.id).single()
  const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const formationNom = (sess as any).formation?.intitule || sess.intitule || 'Formation'

  const emailParams = {
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || org?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: `${formateur.prenom} ${formateur.nom}`,
    subject: `Votre prochaine formation — ${formationNom}`,
    docTitle: 'Informations de votre session de formation',
    intro: "Voici les informations utiles pour la session que vous allez animer. Retrouvez le détail, l'émargement et le contenu pédagogique dans votre espace formateur.",
    metadata: ([
      ['Formation', formationNom],
      ['Dates', `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`],
      sess.horaires ? ['Horaires', String(sess.horaires)] : null,
      ['Durée', (sess as any).formation?.duree_heures ? `${(sess as any).formation.duree_heures} h` : '—'],
      ['Lieu', lieu],
      cli?.raison_sociale ? ['Établissement', String(cli.raison_sociale)] : null,
      contactLine ? ['Contact sur place', contactLine] : null,
      ['Stagiaires', String(nbApprenants || 0)],
    ].filter(Boolean)) as [string, string][],
    ctaLabel: 'Accéder à mon espace formateur',
    ctaUrl: spaceUrl,
    footerNote: 'Merci de vérifier ces informations avant la session et de nous signaler tout changement.',
  }

  // Aperçu : renvoie le HTML sans envoyer
  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject, email: formateur.email } }
  }

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...emailParams,
    to: formateur.email,
    organizationId: session.organization.id,
    entityType: 'session',
    entityId: sessionId,
    triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error }

  await logAudit({ action: 'send_session_info_formateur', entity_type: 'session', entity_id: sessionId, details: { email: formateur.email } })
  return { success: true, data: { email: formateur.email } }
}

/**
 * Envoie la convocation de formation au référent (contact) de l'établissement :
 * email brandé listant les participants + convocation de session en pièce jointe.
 */
export async function sendConvocationToReferentAction(sessionId: string, opts?: { preview?: boolean }): Promise<ActionResult & { data?: { email?: string; html?: string; subject?: string } }> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions')
    .select('*, formation:formation_id(intitule, duree_heures, prerequis), formateur:formateurs(prenom, nom), client:client_id(id, raison_sociale, nom_commercial, sigle)')
    .eq('id', sessionId).eq('organization_id', session.organization.id).single()
  if (!sess) return { success: false, error: 'Session introuvable' }
  if (!sess.client_id) return { success: false, error: 'Aucun établissement rattaché à la session' }

  const { data: contacts } = await supabase
    .from('contacts').select('prenom, nom, poste, email, est_signataire, est_principal').eq('client_id', sess.client_id)
  const list = (contacts || []) as any[]
  const ref = list.find((c) => c.est_signataire && c.email) || list.find((c) => c.est_principal && c.email) || list.find((c) => c.email)
  if (!ref?.email) return { success: false, error: "Le référent (contact de l'établissement) n'a pas d'email renseigné" }
  const referentNom = [ref.prenom, ref.nom].filter(Boolean).join(' ') || 'Madame, Monsieur'

  const { data: inscriptions } = await supabase
    .from('inscriptions').select('apprenant:apprenants(civilite, prenom, nom)').eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')
  const participants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const fmtFr = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const formationNom = (sess as any).formation?.intitule || sess.intitule || 'Formation'
  const cli = (sess as any).client
  const lieu = [sess.lieu, sess.adresse, [sess.code_postal, sess.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'
  const participantsLine = participants.map((p: any) => [p.civilite, p.prenom, p.nom].filter(Boolean).join(' ')).join(', ')

  const emailParams = {
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || org?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: referentNom,
    subject: `Convocation de formation — ${formationNom}`,
    docTitle: 'Convocation de formation',
    intro: `Veuillez trouver ci-jointe la convocation pour la session de formation « ${formationNom} ». Merci de la transmettre aux participants de votre établissement.`,
    metadata: ([
      ['Formation', formationNom],
      ['Dates', `Du ${fmtFr(sess.date_debut)} au ${fmtFr(sess.date_fin)}`],
      sess.horaires ? ['Horaires', String(sess.horaires)] : null,
      ['Lieu', lieu],
      cli?.raison_sociale ? ['Établissement', String(cli.raison_sociale)] : null,
      ['Participants', participantsLine || String(participants.length)],
    ].filter(Boolean)) as [string, string][],
    footerNote: 'La convocation détaillée est en pièce jointe (PDF).',
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject, email: ref.email } }
  }

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { ConvocationSessionPDF } = await import('@/lib/pdf/convocation-session-pdf')
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const orgLogo = await withDocumentLogo(supabase, org)
  const buffer = await renderToBuffer(
    createElement(ConvocationSessionPDF, { session: sess, formation: (sess as any).formation, org: orgLogo, formateur: (sess as any).formateur, participants, entreprise: cli?.raison_sociale, referentNom }) as any
  )

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...emailParams, to: ref.email,
    pdfBuffer: buffer, pdfFilename: `convocation-${sess.reference || sessionId}.pdf`,
    organizationId: session.organization.id, entityType: 'session', entityId: sessionId, triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error }
  await logAudit({ action: 'send_convocation_referent', entity_type: 'session', entity_id: sessionId, details: { email: ref.email } })
  return { success: true, data: { email: ref.email } }
}

/**
 * Marque tout le monde présent sur une journée d'émargement.
 *
 * Le cas courant : le formateur a fait signer sur papier et transmet sa
 * feuille. Cocher trente cases une par une n'apporte rien de plus que de
 * cocher la journée d'un coup, et décourage la saisie — c'est précisément ce
 * qui laisse les dossiers vides.
 *
 * Aucun horodatage n'est inscrit. Une heure inventée — la même pour tout le
 * monde — se verrait au premier coup d'œil et décrédibiliserait la feuille.
 * Le jour est déjà porté par la colonne `date`, et `signed_via` dit d'où
 * vient la présence : la feuille papier, dont le scan reste la pièce.
 */
export async function marquerJourneePresentAction(
  sessionId: string,
  date: string,
  creneau?: string,
): Promise<ActionResult & { data?: { marques: number } }> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire', 'directeur_commercial'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: sess } = await supabase
    .from('sessions').select('id').eq('id', sessionId)
    .eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  let requete = supabase
    .from('emargements')
    .update({
      est_present: true,
      signed_via: 'feuille_papier',
      motif_absence: null,
    })
    .eq('session_id', sessionId)
    .eq('date', date)
    // Une signature déjà recueillie ne se réécrit pas.
    .is('signature_data', null)
  if (creneau) requete = requete.eq('creneau', creneau)

  const { data, error } = await requete.select('id')
  if (error) {
    console.error('[journee presente]', error.message)
    return { success: false, error: 'Enregistrement impossible' }
  }

  await logAudit({
    action: 'update', entity_type: 'session', entity_id: sessionId,
    details: { journee_presente: date, creneau: creneau || 'tous', marques: (data || []).length },
  })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { marques: (data || []).length } }
}

/**
 * Contrat de formation PARTICULIER (session inter) : une personne physique ne
 * signe pas une convention mais un contrat individuel (art. L.6353-3 s.).
 * Crée (ou réutilise) le contrat du participant, génère le lien de signature
 * et envoie l'email avec le PDF — un contrat par inscrit.
 */
export async function envoyerContratParticulierAction(
  sessionId: string,
  apprenantId: string,
): Promise<ActionResult & { data?: { url: string } }> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: sess } = await supabase.from('sessions')
    .select('*, formation:formation_id(intitule, duree_heures, tarif_inter_ht)')
    .eq('id', sessionId).eq('organization_id', orgId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: app } = await supabase.from('apprenants')
    .select('id, civilite, prenom, nom, email, client_id')
    .eq('id', apprenantId).eq('organization_id', orgId).single()
  if (!app) return { success: false, error: 'Participant introuvable' }
  if (!app.email) return { success: false, error: 'Le participant n\'a pas d\'email' }

  // Fiche client particulière : réutilisée, sinon créée depuis l'apprenant
  let clientId = app.client_id as string | null
  if (clientId) {
    const { data: cli } = await supabase.from('clients').select('id, type').eq('id', clientId).maybeSingle()
    if (cli && cli.type !== 'particulier') {
      return { success: false, error: `La fiche client liée est de type entreprise — passez-la en « Particulier » (fiche client) ou déliez l'apprenant, puis réessayez` }
    }
    if (!cli) clientId = null
  }
  if (!clientId) {
    const { data: cree, error: eCli } = await supabase.from('clients').insert({
      organization_id: orgId, type: 'particulier',
      civilite: app.civilite || null, nom: app.nom, prenom: app.prenom,
      raison_sociale: `${app.nom || ''} ${app.prenom || ''}`.trim(),
      email: app.email, financeur_type: 'fonds_propres',
    }).select('id').single()
    if (eCli || !cree) return { success: false, error: 'Création de la fiche particulier impossible' }
    clientId = cree.id
    await supabase.from('apprenants').update({ client_id: clientId }).eq('id', apprenantId)
  }

  // Contrat existant pour CE participant sur CETTE session ?
  const { data: existants } = await supabase.from('conventions')
    .select('id, numero, signature_token, signature_client_date, participants_snapshot')
    .eq('session_id', sessionId).eq('client_id', clientId)
  let conv = (existants || []).find((c: any) =>
    Array.isArray(c.participants_snapshot) && c.participants_snapshot.length === 1 &&
    c.participants_snapshot[0]?.apprenant_id === apprenantId) || null
  if (conv?.signature_client_date) return { success: false, error: `Contrat ${conv.numero} déjà signé` }

  const { createHash, randomBytes } = await import('crypto')
  if (!conv) {
    const { count } = await supabase.from('conventions').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
    const numero = `CT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
    const token = createHash('sha256').update(randomBytes(32)).digest('hex')
    const expire = new Date(); expire.setDate(expire.getDate() + 30)
    const tarif = (sess as any).formation?.tarif_inter_ht != null ? Number((sess as any).formation.tarif_inter_ht) : null
    const { data: cree, error: eConv } = await supabase.from('conventions').insert({
      organization_id: orgId, numero, type: 'inter_entreprise', session_id: sessionId,
      client_id: clientId, formation_id: sess.formation_id, status: 'envoyee',
      objet: `Contrat de formation professionnelle — ${(sess as any).formation?.intitule || 'Formation'}`,
      nombre_stagiaires: 1, duree_heures: (sess as any).formation?.duree_heures || null,
      lieu: sess.lieu || null,
      dates_formation: `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin).toLocaleDateString('fr-FR')}`,
      montant_ht: tarif, taux_tva: 0, montant_ttc: tarif,
      participants_snapshot: [{ apprenant_id: apprenantId, nom: app.nom, prenom: app.prenom }],
      signature_token: token, signature_token_expires_at: expire.toISOString(),
      sent_at: new Date().toISOString(), date_emission: new Date().toISOString().slice(0, 10),
      created_by: session.user.id,
    }).select('id, numero, signature_token').single()
    if (eConv || !cree) return { success: false, error: 'Création du contrat impossible' }
    conv = cree as any
  } else {
    // Renvoi : le lien repart pour 30 jours (jeton créé s'il manque)
    const expire = new Date(); expire.setDate(expire.getDate() + 30)
    const token = (conv as any).signature_token || createHash('sha256').update(randomBytes(32)).digest('hex')
    await supabase.from('conventions')
      .update({ signature_token: token, signature_token_expires_at: expire.toISOString() })
      .eq('id', (conv as any).id)
    conv = { ...(conv as any), signature_token: token } as any
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/convention/${conv!.signature_token}/signer`

  // PDF (variante particulier via client.type) + email
  try {
    const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
    const loaded = await loadConventionForPdf(supabase, conv!.id)
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { ConventionPDF } = await import('@/lib/pdf/convention-pdf')
    const pdf = await renderToBuffer(createElement(ConventionPDF, { convention: loaded!.convention, org: loaded!.org }) as any)

    const { sendDocumentEmail } = await import('@/lib/email')
    const { resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
    const emailLogo = await resolveEmailLogoUrl(supabase, loaded!.org)
    await sendDocumentEmail({
      to: app.email,
      orgName: (loaded!.org as any)?.name || 'Lab Learning',
      orgEmail: (loaded!.org as any)?.email_contact || (loaded!.org as any)?.email,
      orgLogoUrl: emailLogo || undefined,
      qualiopiCertified: (loaded!.org as any)?.is_qualiopi !== false,
      recipientName: `${app.civilite || ''} ${app.prenom || ''} ${app.nom || ''}`.trim(),
      subject: `Contrat de formation ${conv!.numero} — signature requise`,
      docTitle: 'Votre contrat de formation à signer',
      intro: `Vous trouverez ci-joint votre contrat de formation professionnelle pour la formation « ${(sess as any).formation?.intitule || ''} ». Vous pouvez le signer en ligne via le bouton ci-dessous. Conformément au Code du travail, vous disposez d'un délai de rétractation de 10 jours à compter de la signature.`,
      metadata: [
        ['Référence', conv!.numero || ''],
        ['Formation', (sess as any).formation?.intitule || '—'],
        ['Dates', `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin).toLocaleDateString('fr-FR')}`],
      ],
      ctaLabel: 'Signer le contrat en ligne',
      ctaUrl: url,
      pdfBuffer: Buffer.from(pdf), pdfFilename: `contrat-formation-${conv!.numero}.pdf`,
      organizationId: orgId, entityType: 'convention', entityId: conv!.id, triggeredBy: session.user.id,
    })
  } catch (e: any) {
    console.error('[contrat particulier]', e?.message)
    return { success: false, error: 'Contrat créé mais envoi email impossible — réessayez' }
  }

  await logAudit({ action: 'send_contrat_particulier', entity_type: 'convention', entity_id: conv!.id, details: { sessionId, apprenantId } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { url } }
}

/**
 * Convention ENTREPRISE sur session INTER : chaque entreprise qui envoie des
 * stagiaires signe SA convention, couvrant ses seuls apprenants, au tarif
 * inter × nb. (Pas de gate recueil ici : sur une session catalogue inter,
 * l'analyse du besoin passe par le positionnement individuel des stagiaires.)
 */
export async function envoyerConventionEntrepriseInterAction(
  sessionId: string,
  clientId: string,
  /** lienSeul : prépare la convention et son lien de signature SANS envoyer d'email (lien à transmettre soi-même). */
  opts?: { lienSeul?: boolean },
): Promise<ActionResult & { data?: { url: string } }> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: sess } = await supabase.from('sessions')
    .select('*, formation:formation_id(intitule, duree_heures, tarif_inter_ht)')
    .eq('id', sessionId).eq('organization_id', orgId).single()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: client } = await supabase.from('clients')
    .select('id, type, raison_sociale, nom_commercial, email')
    .eq('id', clientId).eq('organization_id', orgId).single()
  if (!client) return { success: false, error: 'Entreprise introuvable' }

  // Les apprenants de CETTE entreprise inscrits à la session
  const { data: insc } = await supabase.from('inscriptions')
    .select('apprenant:apprenants(id, prenom, nom, client_id)')
    .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')
  const siens = (insc || []).map((i: any) => i.apprenant).filter((a: any) => a?.client_id === clientId)
  if (!siens.length) return { success: false, error: 'Aucun inscrit rattaché à cette entreprise' }

  // Convention existante de cette entreprise sur cette session ?
  const { data: existantes } = await supabase.from('conventions')
    .select('id, numero, signature_token, signature_client_date')
    .eq('session_id', sessionId).eq('client_id', clientId)
    .order('created_at', { ascending: false })
  let conv = (existantes || [])[0] || null
  if (conv?.signature_client_date) return { success: false, error: `Convention ${conv.numero} déjà signée` }

  const { createHash, randomBytes } = await import('crypto')
  if (!conv) {
    const { count } = await supabase.from('conventions').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
    const numero = `CV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
    const token = createHash('sha256').update(randomBytes(32)).digest('hex')
    const expire = new Date(); expire.setDate(expire.getDate() + 30)
    // Le prix saisi sur la session fait foi pour l'entreprise de la session ;
    // le tarif catalogue × nb de stagiaires ne sert qu'aux autres entreprises
    // d'une inter multi-clients (ou quand aucun prix n'est saisi).
    const tarifUnitaire = (sess as any).formation?.tarif_inter_ht != null ? Number((sess as any).formation.tarif_inter_ht) : null
    const prixSession = (sess as any).prix_ht != null && (sess.client_id === clientId || !sess.client_id) ? Number((sess as any).prix_ht) : null
    const montant = prixSession ?? (tarifUnitaire != null ? tarifUnitaire * siens.length : null)
    const { data: cree, error: eConv } = await supabase.from('conventions').insert({
      organization_id: orgId, numero, type: 'inter_entreprise', session_id: sessionId,
      client_id: clientId, formation_id: sess.formation_id, status: 'envoyee',
      objet: `Convention de formation — ${(sess as any).formation?.intitule || 'Formation'}`,
      nombre_stagiaires: siens.length, duree_heures: (sess as any).formation?.duree_heures || null,
      lieu: sess.lieu || null,
      dates_formation: `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin).toLocaleDateString('fr-FR')}`,
      montant_ht: montant, taux_tva: 0, montant_ttc: montant,
      participants_snapshot: siens.map((a: any) => ({ apprenant_id: a.id, nom: a.nom, prenom: a.prenom })),
      signature_token: token, signature_token_expires_at: expire.toISOString(),
      sent_at: new Date().toISOString(), date_emission: new Date().toISOString().slice(0, 10),
      created_by: session.user.id,
    }).select('id, numero, signature_token').single()
    if (eConv || !cree) return { success: false, error: 'Création de la convention impossible' }
    conv = cree as any
  } else {
    // Renvoi : le lien repart pour 30 jours (jeton créé s'il manque)
    const expire = new Date(); expire.setDate(expire.getDate() + 30)
    const token = (conv as any).signature_token || createHash('sha256').update(randomBytes(32)).digest('hex')
    await supabase.from('conventions')
      .update({ signature_token: token, signature_token_expires_at: expire.toISOString() })
      .eq('id', (conv as any).id)
    conv = { ...(conv as any), signature_token: token } as any
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'}/convention/${conv!.signature_token}/signer`

  if (opts?.lienSeul) {
    await logAudit({ action: 'generate_signature_link', entity_type: 'convention', entity_id: conv!.id })
    revalidatePath(`/dashboard/sessions/${sessionId}`)
    return { success: true, data: { url } }
  }

  // Destinataire : email client, sinon premier contact
  let toEmail: string | null = client.email || null
  let toName = client.nom_commercial || client.raison_sociale || 'Madame, Monsieur'
  if (!toEmail) {
    const { data: contact } = await supabase.from('contacts')
      .select('prenom, nom, email').eq('client_id', clientId).not('email', 'is', null).limit(1).maybeSingle()
    if (contact?.email) { toEmail = contact.email; toName = [contact.prenom, contact.nom].filter(Boolean).join(' ') || toName }
  }
  if (!toEmail) return { success: false, error: 'Aucun email sur la fiche entreprise ni ses contacts' }

  try {
    const { loadConventionForPdf } = await import('@/lib/pdf/convention-data')
    const loaded = await loadConventionForPdf(supabase, conv!.id)
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { ConventionPDF } = await import('@/lib/pdf/convention-pdf')
    const pdf = await renderToBuffer(createElement(ConventionPDF, { convention: loaded!.convention, org: loaded!.org }) as any)
    const { sendDocumentEmail } = await import('@/lib/email')
    const { resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
    const emailLogo = await resolveEmailLogoUrl(supabase, loaded!.org)
    await sendDocumentEmail({
      to: toEmail,
      orgName: (loaded!.org as any)?.name || 'Lab Learning',
      orgEmail: (loaded!.org as any)?.email_contact || (loaded!.org as any)?.email,
      orgLogoUrl: emailLogo || undefined,
      qualiopiCertified: (loaded!.org as any)?.is_qualiopi !== false,
      recipientName: toName,
      subject: `Convention de formation ${conv!.numero} — signature requise`,
      docTitle: 'Convention de formation à signer',
      intro: `Veuillez trouver ci-joint la convention de formation couvrant ${siens.length > 1 ? `vos ${siens.length} stagiaires` : 'votre stagiaire'} pour la formation « ${(sess as any).formation?.intitule || ''} ». Vous pouvez la signer en ligne via le bouton ci-dessous.`,
      metadata: [
        ['Référence', conv!.numero || ''],
        ['Formation', (sess as any).formation?.intitule || '—'],
        ['Stagiaires', siens.map((a: any) => `${a.prenom || ''} ${a.nom || ''}`.trim()).join(', ')],
        ['Dates', `Du ${new Date(sess.date_debut).toLocaleDateString('fr-FR')} au ${new Date(sess.date_fin).toLocaleDateString('fr-FR')}`],
      ],
      ctaLabel: 'Signer la convention en ligne',
      ctaUrl: url,
      pdfBuffer: Buffer.from(pdf), pdfFilename: `convention-${conv!.numero}.pdf`,
      organizationId: orgId, entityType: 'convention', entityId: conv!.id, triggeredBy: session.user.id,
    })
  } catch (e: any) {
    console.error('[convention inter]', e?.message)
    return { success: false, error: 'Convention créée mais envoi email impossible — réessayez' }
  }

  await logAudit({ action: 'send_convention_inter', entity_type: 'convention', entity_id: conv!.id, details: { sessionId, clientId } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { url } }
}


/** Session hygiène terminée : attestations groupées + diplôme d'établissement
 *  partent automatiquement à l'établissement (référent client). Idempotent :
 *  ne renvoie pas si un envoi hygiène automatique existe déjà pour la session. */
/**
 * Liens de signature d'émargement : chaque apprenant signe SES créneaux sur
 * son portail (/portail/{token}/mes-emargements). Génère (ou réutilise) le
 * token portail de chaque inscrit et renvoie les liens — l'envoi email est
 * une action séparée, tracée dans email_logs.
 */
export async function liensSignatureEmargementsAction(sessionId: string): Promise<ActionResult & {
  data?: { liens: { apprenant_id: string; nom: string; email: string | null; url: string }[] }
}> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  const { data: sess } = await supabase.from('sessions').select('id')
    .eq('id', sessionId).eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: insc } = await supabase.from('inscriptions')
    .select('apprenant:apprenants(id, prenom, nom, email)')
    .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')

  const liens: { apprenant_id: string; nom: string; email: string | null; url: string }[] = []
  for (const i of (insc || []) as any[]) {
    const a = i.apprenant
    if (!a) continue
    // Token portail existant, sinon création
    const { data: existant } = await supabase.from('portal_access_tokens')
      .select('token').eq('organization_id', session.organization.id)
      .eq('type', 'apprenant').eq('apprenant_id', a.id).eq('is_active', true)
      .limit(1).maybeSingle()
    let token = existant?.token
    if (!token) {
      const { data: cree, error } = await supabase.from('portal_access_tokens')
        .insert({ organization_id: session.organization.id, type: 'apprenant', apprenant_id: a.id, email: a.email, created_by: session.user.id })
        .select('token').single()
      if (error) return { success: false, error: `Token impossible pour ${a.prenom} ${a.nom}` }
      token = cree.token
    }
    liens.push({
      apprenant_id: a.id,
      nom: `${a.prenom || ''} ${a.nom || ''}`.trim(),
      email: a.email || null,
      url: `${appUrl}/portail/${token}/mes-emargements`,
    })
  }
  return { success: true, data: { liens } }
}

/** Envoie par email le lien de signature d'émargement à un apprenant. */
export async function envoyerLienEmargementAction(sessionId: string, apprenantId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  const { data: sess } = await supabase.from('sessions')
    .select('id, date_debut, date_fin, formation:formation_id(intitule)')
    .eq('id', sessionId).eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const { data: a } = await supabase.from('apprenants').select('id, prenom, nom, email')
    .eq('id', apprenantId).eq('organization_id', session.organization.id).maybeSingle()
  if (!a) return { success: false, error: 'Apprenant introuvable' }
  if (!a.email) return { success: false, error: `${a.prenom} ${a.nom} n'a pas d'adresse email` }

  const { data: tok } = await supabase.from('portal_access_tokens')
    .select('token').eq('organization_id', session.organization.id)
    .eq('type', 'apprenant').eq('apprenant_id', a.id).eq('is_active', true)
    .limit(1).maybeSingle()
  if (!tok) return { success: false, error: 'Générez d\'abord le lien (bouton Liens de signature)' }

  const url = `${appUrl}/portail/${tok.token}/mes-emargements`
  const intitule = (sess as any).formation?.intitule || 'votre formation'
  const { data: org } = await supabase.from('organizations').select('name, email').eq('id', session.organization.id).single()
  const { sendBrandedEmail } = await import('@/lib/email')
  const r = await sendBrandedEmail({
    to: a.email,
    toName: `${a.prenom || ''} ${a.nom || ''}`.trim(),
    subject: `Signature de vos émargements : ${intitule}`,
    html: `
      <div style="font-family:sans-serif;color:#1c1917;line-height:1.6">
        <p>Bonjour ${a.prenom || ''},</p>
        <p>Pour valider votre présence à la formation « <strong>${intitule}</strong> », merci de signer
        vos feuilles d'émargement en ligne. Cela ne prend qu'une minute, depuis votre téléphone ou un ordinateur :</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${url}" style="display:inline-block;background:#205040;color:#ffffff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600">
            Signer mes émargements
          </a>
        </p>
        <p style="font-size:13px;color:#57534E">Ce lien est personnel, merci de ne pas le transférer.
        Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br/>${url}</p>
      </div>`,
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email || undefined,
    organizationId: session.organization.id,
    entityType: 'emargement',
    entityId: sessionId,
    triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error || 'Envoi impossible' }
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true, data: { email: a.email } }
}
