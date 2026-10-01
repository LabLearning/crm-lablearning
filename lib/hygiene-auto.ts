/**
 * Envoi automatique des attestations d'hygiène à la clôture d'une session :
 * attestations groupées + diplôme d'établissement au client (email, sinon
 * premier contact). Idempotent via email_logs — appelé au passage en
 * « terminée », que ce soit à la main (fiche session) ou par le cron
 * statuts-sessions.
 */
export async function envoyerHygieneAutomatique(supabase: any, sessionId: string, orgId: string) {
  const { estFormationHygiene } = await import('@/lib/formation-hygiene')
  const { data: sess } = await supabase.from('sessions')
    .select('id, reference, date_debut, date_fin, ville, formation:formation_id(intitule, categorie, duree_heures), client:client_id(id, raison_sociale, nom_commercial, email, ville), formateur:formateurs(prenom, nom)')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess || !estFormationHygiene((sess as any).formation)) return
  const client: any = (sess as any).client
  if (!client) return

  // Destinataire : email client, sinon premier contact
  let toEmail: string | null = client.email || null
  let toName = client.nom_commercial || client.raison_sociale || 'Madame, Monsieur'
  if (!toEmail) {
    const { data: contact } = await supabase.from('contacts')
      .select('prenom, nom, email').eq('client_id', client.id).not('email', 'is', null).limit(1).maybeSingle()
    if (contact?.email) { toEmail = contact.email; toName = [contact.prenom, contact.nom].filter(Boolean).join(' ') || toName }
  }
  if (!toEmail) return

  // Garde anti-doublon : un envoi automatique déjà tracé pour cette session ?
  // Si la vérification échoue, on n'envoie pas (pas de doublon au client).
  const { data: deja, error: errDeja } = await supabase.from('email_logs')
    .select('id').eq('organization_id', orgId).eq('entity_type', 'session').eq('entity_id', sessionId)
    .ilike('subject', '%attestations d_hygiène%').limit(1)
  if (errDeja) { console.error('[hygiene-auto] vérification des envois impossible', errDeja); return }
  if ((deja || []).length) return

  // Stagiaires + heures réellement suivies (mêmes règles que la route PDF)
  const { data: inscriptions } = await supabase.from('inscriptions')
    .select('apprenant:apprenants(id, civilite, prenom, nom, date_naissance, entreprise)')
    .eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')
  const apprenants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)
    .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
  if (!apprenants.length) return
  const { data: em } = await supabase.from('emargements')
    .select('apprenant_id, est_present').eq('session_id', sessionId)
  const dureePrevue = Number((sess as any).formation?.duree_heures || 0)
  if (!dureePrevue) return // pas de durée fiable : jamais d'attestation à 0 h
  const heuresParApprenant: Record<string, number> = {}
  for (const a of apprenants) {
    const lignes = (em || []).filter((e: any) => e.apprenant_id === a.id)
    const presents = lignes.filter((e: any) => e.est_present).length
    heuresParApprenant[a.id] = lignes.length > 0
      ? Math.round((dureePrevue * presents / lignes.length) * 100) / 100
      : dureePrevue
  }
  // RÈGLE ABSOLUE : aucune attestation à 0 heure ne part. Un stagiaire sans
  // présence pointée/signée est retiré du lot ; s'il ne reste personne,
  // l'envoi attend que les présences soient posées (liens de signature).
  const apprenantsValides = apprenants.filter((a: any) => (heuresParApprenant[a.id] || 0) > 0)
  if (!apprenantsValides.length) return
  apprenants.length = 0
  apprenants.push(...apprenantsValides)

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo, resolveEmailLogoUrl } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { AttestationHygienePDF } = await import('@/lib/pdf/attestation-hygiene-pdf')
  const { DiplomeEtablissementPDF } = await import('@/lib/pdf/diplome-etablissement-pdf')

  const attestations = await renderToBuffer(createElement(AttestationHygienePDF, {
    apprenants, session: sess as any, formation: (sess as any).formation, org, heuresParApprenant,
  }) as any)
  const diplome = await renderToBuffer(createElement(DiplomeEtablissementPDF, {
    org,
    etablissement: client.nom_commercial || client.raison_sociale || 'Établissement',
    ville: client.ville || (sess as any).ville || null,
    formationIntitule: (sess as any).formation?.intitule || 'Hygiène alimentaire',
    dateDebut: (sess as any).date_debut, dateFin: (sess as any).date_fin,
    stagiaires: apprenants,
    formateurNom: (sess as any).formateur ? `${(sess as any).formateur.prenom} ${(sess as any).formateur.nom}` : null,
  }) as any)

  const { sendDocumentEmail } = await import('@/lib/email')
  const emailLogo = await resolveEmailLogoUrl(supabase, orgRaw)
  await sendDocumentEmail({
    to: toEmail,
    orgName: orgRaw?.name || 'Lab Learning',
    orgEmail: (orgRaw as any)?.email_contact || orgRaw?.email,
    orgLogoUrl: emailLogo || undefined,
    qualiopiCertified: (orgRaw as any)?.is_qualiopi !== false,
    recipientName: toName,
    subject: `Attestations d'hygiène alimentaire — ${(sess as any).formation?.intitule || 'formation'}`,
    docTitle: 'Vos attestations d\'hygiène alimentaire',
    intro: `La formation de votre personnel est terminée. Vous trouverez ci-joint les attestations d'hygiène alimentaire de vos ${apprenants.length > 1 ? `${apprenants.length} collaborateurs` : 'collaborateur'} (à conserver — elles sont présentées lors des contrôles sanitaires), ainsi que le diplôme de votre établissement, à afficher si vous le souhaitez.`,
    metadata: [
      ['Formation', (sess as any).formation?.intitule || '—'],
      ['Personnel formé', apprenants.map((a: any) => `${a.prenom || ''} ${a.nom || ''}`.trim()).join(', ')],
      ['Dates', `Du ${new Date((sess as any).date_debut).toLocaleDateString('fr-FR')} au ${new Date((sess as any).date_fin).toLocaleDateString('fr-FR')}`],
    ],
    pdfBuffer: Buffer.from(attestations),
    pdfFilename: `attestations-hygiene-${(sess as any).reference || 'session'}.pdf`,
    extraAttachments: [{ filename: `diplome-etablissement.pdf`, content: Buffer.from(diplome), contentType: 'application/pdf' }],
    organizationId: orgId, entityType: 'session', entityId: sessionId,
  })
}


/**
 * Aperçu SANS ENVOI : applique exactement les mêmes règles que l'envoi
 * (formation hygiène, destinataire, anti-doublon, jamais 0 h) et dit ce qui
 * partirait. Sert au mode validation du rattrapage.
 */
export async function apercuHygiene(supabase: any, sessionId: string, orgId: string): Promise<{
  envoyable: boolean; raison?: string; client?: string; destinataire?: string; stagiaires?: number; heures?: string
}> {
  const { estFormationHygiene } = await import('@/lib/formation-hygiene')
  const { data: sess } = await supabase.from('sessions')
    .select('id, formation:formation_id(intitule, categorie, duree_heures), client:client_id(id, raison_sociale, nom_commercial, email)')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess || !estFormationHygiene((sess as any).formation)) return { envoyable: false, raison: 'pas une formation hygiène' }
  const client: any = (sess as any).client
  if (!client) return { envoyable: false, raison: 'aucun client' }
  const nomClient = client.nom_commercial || client.raison_sociale || '?'

  let toEmail: string | null = client.email || null
  if (!toEmail) {
    const { data: contact } = await supabase.from('contacts')
      .select('email').eq('client_id', client.id).not('email', 'is', null).limit(1).maybeSingle()
    toEmail = contact?.email || null
  }
  if (!toEmail) return { envoyable: false, raison: 'aucun email (client ni contact)', client: nomClient }

  const { data: deja, error: errDeja } = await supabase.from('email_logs')
    .select('id').eq('organization_id', orgId).eq('entity_type', 'session').eq('entity_id', sessionId)
    .ilike('subject', '%attestations d_hygiène%').limit(1)
  if (errDeja) return { envoyable: false, raison: 'vérification des envois impossible, réessayez', client: nomClient }
  if ((deja || []).length) return { envoyable: false, raison: 'déjà envoyée', client: nomClient }

  const { data: inscriptions } = await supabase.from('inscriptions')
    .select('apprenant_id').eq('session_id', sessionId).not('status', 'in', '("annule","abandonne")')
  if (!inscriptions?.length) return { envoyable: false, raison: 'aucun inscrit', client: nomClient }
  const dureePrevue = Number((sess as any).formation?.duree_heures || 0)
  if (!dureePrevue) return { envoyable: false, raison: 'durée de formation absente', client: nomClient }
  const { data: em } = await supabase.from('emargements').select('apprenant_id, est_present').eq('session_id', sessionId)
  const heures = inscriptions.map((i: any) => {
    const lignes = (em || []).filter((e: any) => e.apprenant_id === i.apprenant_id)
    const presents = lignes.filter((e: any) => e.est_present).length
    return lignes.length > 0 ? Math.round((dureePrevue * presents / lignes.length) * 100) / 100 : dureePrevue
  })
  const valides = heures.filter((h: number) => h > 0)
  if (!valides.length) return { envoyable: false, raison: 'tous les stagiaires à 0 h (présences non posées)', client: nomClient }
  return {
    envoyable: true, client: nomClient, destinataire: toEmail,
    stagiaires: valides.length,
    heures: `${Math.min(...valides)} à ${Math.max(...valides)} h` + (valides.length < heures.length ? ` (${heures.length - valides.length} stagiaire(s) à 0 h exclu(s))` : ''),
  }
}
