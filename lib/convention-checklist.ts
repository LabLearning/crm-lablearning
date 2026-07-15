// Contrôle de complétude d'une convention de formation AVANT génération PDF
// et AVANT envoi en signature. Vérifie les mentions obligatoires (Code du
// travail L.6353-1/L.6353-2, exigences OPCO et Qualiopi).
//
// Les clauses fixes du modèle (nature de l'action, modalités de suivi
// émargement/certificat, document remis, conditions d'annulation/dédit,
// litiges, modalités de règlement) sont garanties par le template PDF et
// n'ont donc pas besoin d'être contrôlées en base.

export interface ConventionIssue {
  section: string
  label: string
}

export interface ConventionCheckResult {
  ok: boolean
  blocking: ConventionIssue[]
  warnings: ConventionIssue[]
}

const has = (v: any) => v != null && String(v).trim() !== ''

export async function checkConventionCompleteness(
  supabase: any,
  conventionId: string,
): Promise<ConventionCheckResult | null> {
  const { loadConventionForPdf } = await import('./pdf/convention-data')
  const loaded = await loadConventionForPdf(supabase, conventionId)
  if (!loaded) return null
  const { convention, org } = loaded as any
  const client = convention.client
  const formation = convention.formation
  const session = convention.session
  const participants: any[] = convention.participants || []

  const blocking: ConventionIssue[] = []
  const warnings: ConventionIssue[] = []
  const miss = (section: string, label: string) => blocking.push({ section, label })
  const warn = (section: string, label: string) => warnings.push({ section, label })

  // ── 1. Organisme de formation ──
  const S1 = 'Organisme de formation'
  if (!has(org?.name)) miss(S1, "Nom de l'organisme")
  if (!has(org?.address) || !has(org?.postal_code) || !has(org?.city)) miss(S1, "Adresse complète de l'organisme")
  if (!has(org?.siret)) miss(S1, "SIRET de l'organisme")
  if (!has(org?.numero_da)) miss(S1, "Numéro de déclaration d'activité")
  if (!has(org?.representant_legal_nom)) miss(S1, "Représentant légal de l'organisme")

  // ── 2. Client / bénéficiaire ──
  const S2 = 'Client / bénéficiaire'
  if (!client) {
    miss(S2, 'Client lié à la convention')
  } else {
    const isEntreprise = client.type !== 'particulier'
    if (isEntreprise ? !has(client.raison_sociale) : !has(client.nom)) miss(S2, 'Raison sociale du client')
    if (!has(client.adresse) || !has(client.code_postal) || !has(client.ville)) miss(S2, 'Adresse complète du client')
    if (isEntreprise && !has(client.siret)) miss(S2, 'SIRET du client')
    // Personne habilitée à signer : contact lié à la convention, ou contact
    // signataire du client, ou email direct du client (signature en ligne)
    if (!convention.contact_id && !has(client.email)) {
      const { data: signataire } = await supabase
        .from('contacts')
        .select('id')
        .eq('client_id', client.id)
        .or('est_signataire.eq.true,email.not.is.null')
        .limit(1)
        .maybeSingle()
      if (!signataire) miss(S2, 'Représentant / personne habilitée à signer (contact avec email)')
    }
  }

  // ── 3. Formation ──
  const S3 = 'Formation'
  if (!formation) {
    miss(S3, 'Formation liée à la convention')
  } else {
    if (!has(formation.intitule)) miss(S3, "Intitulé exact de l'action")
    if (!has(formation.objectifs_pedagogiques)) miss(S3, 'Objectifs pédagogiques')
    if (!has(formation.programme_detaille)) miss(S3, 'Programme / contenu détaillé')
    if (!has(formation.public_vise)) miss(S3, 'Public visé')
    if (!has(formation.prerequis)) miss(S3, 'Prérequis (indiquer « Aucun prérequis » le cas échéant)')
    if (!(Number(formation.duree_heures || convention.duree_heures) > 0)) miss(S3, 'Durée totale en heures')
    if (!(Number(formation.duree_jours) > 0)) miss(S3, 'Durée totale en jours')
  }
  if (session) {
    if (!has(session.date_debut) || !has(session.date_fin)) miss(S3, 'Dates de formation (session)')
    const horairesOk = (Array.isArray(session.horaires_jours) && session.horaires_jours.length > 0) || has(session.horaires)
    if (!horairesOk) miss(S3, 'Horaires détaillés (session)')
    const lieuOk = has(session.lieu) || has(session.adresse) || has(session.ville) || session.modalite === 'distanciel' || has(session.lien_visio)
    if (!lieuOk) miss(S3, 'Lieu de réalisation (session)')
    if (!has(session.modalite) && !has(formation?.modalite)) miss(S3, "Modalité d'organisation (présentiel / distanciel / mixte)")
  } else {
    if (!has(convention.dates_formation)) miss(S3, 'Dates de formation')
    if (!has(convention.lieu)) miss(S3, 'Lieu de réalisation')
    warn(S3, 'Aucune session liée : horaires détaillés non vérifiables')
  }

  // ── 4. Participants — BLOQUANT : la convention ne se génère pas tant
  // que tous les participants ne sont pas inscrits sur la session ──
  const S4 = 'Participants'
  if (participants.length === 0) {
    miss(S4, 'Aucun participant inscrit sur la session (inscrivez les stagiaires avant de générer la convention)')
  } else if (Number(convention.nombre_stagiaires) > participants.length) {
    miss(S4, `Participants incomplets : ${participants.length} inscrit${participants.length > 1 ? 's' : ''} sur ${convention.nombre_stagiaires} prévus`)
  }

  // ── 5. Modalités pédagogiques et encadrement ──
  const S5 = 'Modalités pédagogiques'
  if (formation) {
    if (!has(formation.methodes_pedagogiques)) miss(S5, 'Moyens / méthodes pédagogiques')
    if (!has(formation.moyens_techniques)) miss(S5, 'Moyens techniques')
    if (!has(formation.modalites_evaluation)) miss(S5, "Modalités d'évaluation")
  }
  if (session && !session.formateur_id) miss(S5, 'Formateur désigné sur la session')

  // ── 6. Informations financières ──
  const S6 = 'Financier'
  if (!(Number(convention.montant_ht) > 0)) miss(S6, 'Prix de la formation (montant HT)')
  if (convention.taux_tva == null) miss(S6, 'Mention TVA / exonération (taux de TVA)')

  // ── 7. Clauses administratives ──
  const S7 = 'Clauses administratives'
  if (!has(org?.referent_handicap_nom)) miss(S7, 'Référent handicap (paramètres de l\'organisation)')

  return { ok: blocking.length === 0, blocking, warnings }
}

/** Message utilisateur : liste groupée par section. */
export function formatConventionIssues(issues: ConventionIssue[]): string {
  const bySection = new Map<string, string[]>()
  for (const i of issues) {
    ;(bySection.get(i.section) || bySection.set(i.section, []).get(i.section))!.push(i.label)
  }
  return Array.from(bySection.entries())
    .map(([section, labels]) => `${section} : ${labels.join(', ')}`)
    .join(' — ')
}
