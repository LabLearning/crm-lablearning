import { randomBytes, createHash } from 'crypto'

/**
 * Envoi et diffusion des contrats de prestation formateur.
 * Un contrat porte soit sur une session, soit sur une intervention POEI :
 * tout ce qui suit traite les deux cas indifféremment.
 */

function newToken() {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

/** Charge un contrat avec son formateur, son organisation et sa mission */
async function loadContrat(supabase: any, contratId: string) {
  const { data: contrat } = await supabase
    .from('contrats_formateur')
    .select(`
      *,
      formateur:formateurs(id, prenom, nom, email),
      session:sessions(id, reference, date_debut, date_fin, formation:formation_id(intitule)),
      intervention:poei_interventions(id, libelle, date_debut, date_fin, poei:poei(numero, formation:formations(intitule)))
    `)
    .eq('id', contratId)
    .single()
  if (!contrat) return null

  const { data: orgRaw } = await supabase
    .from('organizations').select('*').eq('id', contrat.organization_id).single()

  const session = Array.isArray(contrat.session) ? contrat.session[0] : contrat.session
  const intervention = Array.isArray(contrat.intervention) ? contrat.intervention[0] : contrat.intervention
  const formateur = Array.isArray(contrat.formateur) ? contrat.formateur[0] : contrat.formateur

  const intitule = session?.formation?.intitule || session?.reference
    || intervention?.libelle || 'Prestation de formation'
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : null
  const debut = fmt(session?.date_debut || intervention?.date_debut || null)
  const fin = fmt(session?.date_fin || intervention?.date_fin || null)
  const periode = debut ? (fin && fin !== debut ? `du ${debut} au ${fin}` : `le ${debut}`) : null

  return { contrat, org: orgRaw, formateur, session, intervention, intitule, periode }
}

/**
 * Le formateur d'une session a changé : le contrat en cours ne vaut plus rien.
 * On l'annule et on neutralise son lien de signature — sans quoi l'ancien
 * formateur pourrait encore signer, et le nouveau se verrait proposer
 * le contrat de son prédécesseur.
 *
 * Un contrat déjà signé est conservé tel quel (pièce contractuelle exécutée),
 * seul son statut passe à « annulé ».
 */
export async function cancelContratOnFormateurChange(
  supabase: any,
  sessionId: string,
  ancienFormateurId: string | null,
): Promise<void> {
  const { data: contrats } = await supabase
    .from('contrats_formateur')
    .select('id, status, signature_formateur_date')
    .eq('session_id', sessionId)
    .neq('status', 'annule')
  if (!contrats?.length) return

  for (const c of contrats) {
    await supabase
      .from('contrats_formateur')
      .update({
        status: 'annule',
        // Le lien de signature doit mourir immédiatement
        signature_token: null,
        signature_token_expires_at: null,
        notes: `Annulé : changement de formateur sur la session${ancienFormateurId ? '' : ''}.`,
      })
      .eq('id', c.id)
  }
}

/**
 * (Re)met un contrat en signature : régénère le lien s'il a expiré,
 * repositionne la date d'envoi et renvoie l'email au formateur.
 */
/**
 * Garantit qu'un contrat de prestation existe pour la session (non annulé).
 * S'il n'y en a pas, il est créé en brouillon avec le montant issu du coût
 * formateur (ou tarif journalier × jours). Retourne l'id du contrat, ou null si
 * la session n'a pas de formateur. Utilisé avant un envoi en signature pour que
 * l'état passe bien à « envoyé » même si le contrat n'avait jamais été généré.
 */
export async function ensureContratFormateur(
  supabase: any,
  sessionId: string,
  createdBy: string,
): Promise<{ id: string } | null> {
  const { data: existing } = await supabase
    .from('contrats_formateur')
    .select('id')
    .eq('session_id', sessionId)
    .neq('status', 'annule')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return { id: existing.id }

  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, formateur_id, cout_formateur, formation:formation_id(duree_jours)')
    .eq('id', sessionId)
    .single()
  if (!sess || !sess.formateur_id) return null

  const { count } = await supabase
    .from('contrats_formateur')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', sess.organization_id)
  const numero = `CT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data: formateurRow } = await supabase
    .from('formateurs').select('tarif_journalier').eq('id', sess.formateur_id).single()
  const tarif = formateurRow?.tarif_journalier || null
  const duree = (sess as any).formation?.duree_jours || null
  const montant = sess.cout_formateur != null
    ? Number(sess.cout_formateur)
    : (tarif && duree ? Number(tarif) * Number(duree) : null)

  const { data: created, error } = await supabase
    .from('contrats_formateur')
    .insert({
      organization_id: sess.organization_id,
      session_id: sessionId,
      formateur_id: sess.formateur_id,
      numero,
      status: 'brouillon',
      tarif_journalier: tarif,
      nombre_jours: duree,
      montant_ht: montant,
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (error || !created) return null
  return { id: created.id }
}

export async function sendContratForSignature(
  supabase: any,
  contratId: string,
): Promise<{ success: boolean; error?: string; signUrl?: string }> {
  const loaded = await loadContrat(supabase, contratId)
  if (!loaded) return { success: false, error: 'Contrat introuvable' }
  const { contrat, org, formateur, intitule, periode } = loaded

  if (contrat.signature_formateur_date) {
    return { success: false, error: 'Ce contrat est déjà signé' }
  }
  if (!formateur?.email) {
    return { success: false, error: 'Le formateur n\'a pas d\'adresse email' }
  }

  // Le lien de signature est réutilisé tant qu'il est valide, sinon régénéré
  const expire = contrat.signature_token_expires_at
    && new Date(contrat.signature_token_expires_at) < new Date()
  let token = contrat.signature_token
  const expires = new Date()
  expires.setDate(expires.getDate() + 30)

  if (!token || expire) token = newToken()

  await supabase
    .from('contrats_formateur')
    .update({
      signature_token: token,
      signature_token_expires_at: expires.toISOString(),
      status: contrat.status === 'brouillon' ? 'envoye' : contrat.status,
      sent_at: new Date().toISOString(),
    })
    .eq('id', contratId)

  const signUrl = `${APP_URL}/f/${token}`

  const { sendDocumentEmail } = await import('@/lib/email')
  const { resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
  const res = await sendDocumentEmail({
    to: formateur.email,
    orgName: org.name,
    orgEmail: (org as any).email_contact || org.email,
    orgLogoUrl: (await resolveEmailLogoUrl(supabase, org)) || undefined,
    qualiopiCertified: org.is_qualiopi !== false,
    recipientName: `${formateur.prenom || ''} ${formateur.nom || ''}`.trim(),
    subject: `Contrat de prestation à signer — ${intitule}`,
    docTitle: 'Contrat de prestation à signer',
    intro: `${org.name} vous transmet votre contrat de prestation. Merci de le signer électroniquement en cliquant sur le bouton ci-dessous. Le lien est valable 30 jours.`,
    metadata: [
      ...(contrat.numero ? [['Référence', contrat.numero]] : []),
      ['Mission', intitule],
      ...(periode ? [['Période', periode]] : []),
      ...(contrat.montant_ht ? [['Montant HT', `${Number(contrat.montant_ht).toLocaleString('fr-FR')} EUR`]] : []),
    ] as [string, string][],
    ctaLabel: 'Signer le contrat',
    ctaUrl: signUrl,
  })

  if (!res.success) return { success: false, error: res.error || 'Envoi impossible' }
  return { success: true, signUrl }
}

/**
 * Rend le PDF du contrat signé et le fige dans le bucket `documents`.
 * L'exemplaire archivé fait foi : il ne doit plus jamais être re-rendu,
 * sans quoi une évolution du gabarit réécrirait un contrat déjà exécuté.
 */
export async function archiveSignedContrat(supabase: any, contratId: string): Promise<Buffer | null> {
  const loaded = await loadContrat(supabase, contratId)
  if (!loaded) return null
  const { contrat, org, formateur, session, intervention } = loaded
  if (!contrat.signature_formateur_date) return null

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { ContratFormateurPDF } = await import('@/lib/pdf/contrat-formateur-pdf')
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const orgPdf = await withDocumentLogo(supabase, org)

  // Le rendu a besoin des données complètes de la mission
  let sessionFull: any = null
  if (session?.id) {
    const { data } = await supabase
      .from('sessions').select('*, formation:formation_id(intitule, duree_heures)')
      .eq('id', session.id).single()
    sessionFull = data
  }
  let interventionFull: any = null
  if (!sessionFull && intervention?.id) {
    const { data } = await supabase
      .from('poei_interventions')
      .select('*, poei:poei(numero, formation:formations(intitule), client:clients(raison_sociale))')
      .eq('id', intervention.id).single()
    interventionFull = data
  }

  const buffer = Buffer.from(await renderToBuffer(
    createElement(ContratFormateurPDF, {
      formateur, org: orgPdf, session: sessionFull, contrat, intervention: interventionFull,
    }) as any,
  ))

  const path = `${contrat.organization_id}/contrats/${contratId}.pdf`
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })

  if (!error) {
    await supabase
      .from('contrats_formateur')
      .update({ storage_path: path, archived_at: new Date().toISOString() })
      .eq('id', contratId)
  } else {
    // L'archivage échoue → on garde le rendu à la volée en repli
    console.error('[archiveSignedContrat]', error)
  }

  return buffer
}

/**
 * Après signature : archive le contrat puis en envoie une copie
 * au formateur et à l'organisme, en pièce jointe PDF.
 */
export async function sendSignedContratCopies(supabase: any, contratId: string): Promise<void> {
  const loaded = await loadContrat(supabase, contratId)
  if (!loaded) return
  const { contrat, org, formateur, intitule, periode } = loaded
  if (!contrat.signature_formateur_date) return

  const destinataires: string[] = []
  if (formateur?.email) destinataires.push(formateur.email)
  const orgEmail = (org as any).email_contact || org.email
  if (orgEmail && !destinataires.includes(orgEmail)) destinataires.push(orgEmail)

  // Archive d'abord : l'exemplaire joint à l'email est celui qui est conservé
  const buffer = await archiveSignedContrat(supabase, contratId)
  if (!buffer || destinataires.length === 0) return

  const { resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
  const { sendDocumentEmail } = await import('@/lib/email')
  await sendDocumentEmail({
    to: destinataires,
    orgName: org.name,
    orgEmail,
    orgLogoUrl: (await resolveEmailLogoUrl(supabase, org)) || undefined,
    qualiopiCertified: org.is_qualiopi !== false,
    recipientName: `${formateur?.prenom || ''} ${formateur?.nom || ''}`.trim() || 'Madame, Monsieur',
    subject: `Contrat de prestation signé${contrat.numero ? ` — ${contrat.numero}` : ''}`,
    docTitle: 'Contrat de prestation signé — copie',
    intro: `Le contrat de prestation a été signé électroniquement. Vous trouverez ci-joint l'exemplaire signé, à conserver pour vos archives.`,
    metadata: [
      ...(contrat.numero ? [['Référence', contrat.numero]] : []),
      ['Mission', intitule],
      ...(periode ? [['Période', periode]] : []),
      ['Signé le', new Date(contrat.signature_formateur_date).toLocaleDateString('fr-FR')],
      ['Signataire', contrat.signature_formateur_nom || ''],
    ] as [string, string][],
    pdfBuffer: buffer,
    pdfFilename: `contrat-${contrat.numero || contratId}-signe.pdf`,
    footerNote: 'Cet exemplaire fait foi entre les parties.',
  })
}
