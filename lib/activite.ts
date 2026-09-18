/**
 * Journal d'activité : vocabulaire et repères d'affichage, sans dépendance
 * serveur (utilisable par les composants client).
 */

export type OperationActivite = 'insert' | 'update' | 'delete'

export interface Activite {
  id: string
  acteur_id: string | null
  acteur_nom?: string | null
  acteur_email?: string | null
  impersone_par: string | null
  transaction_id?: number | string | null
  table_name: string
  record_id: string | null
  operation: OperationActivite
  libelle: string | null
  champs: string[]
  avant: Record<string, unknown> | null
  apres: Record<string, unknown> | null
  annulee_le: string | null
  annulee_par: string | null
  created_at: string
  acteur?: { first_name: string | null; last_name: string | null; avatar_url: string | null; email?: string | null } | null
  impersonateur?: { first_name: string | null; last_name: string | null } | null
}

/** Comment nommer une ligne de chaque table : « la facture », « le client »… */
export const TABLES_ACTIVITE: Record<string, { article: string; nom: string; pluriel: string }> = {
  clients: { article: 'le', nom: 'client', pluriel: 'Clients' },
  contacts: { article: 'le', nom: 'contact', pluriel: 'Contacts' },
  leads: { article: 'le', nom: 'lead', pluriel: 'Leads' },
  apporteurs_affaires: { article: "l'", nom: "apporteur d'affaires", pluriel: "Apporteurs d'affaires" },
  apprenants: { article: "l'", nom: 'apprenant', pluriel: 'Apprenants' },
  formateurs: { article: 'le', nom: 'formateur', pluriel: 'Formateurs' },
  formations: { article: 'la', nom: 'formation', pluriel: 'Catalogue' },
  sessions: { article: 'la', nom: 'session', pluriel: 'Sessions' },
  inscriptions: { article: "l'", nom: 'inscription', pluriel: 'Inscriptions' },
  session_frais: { article: 'le', nom: 'frais de session', pluriel: 'Frais de session' },
  contrats_formateur: { article: 'le', nom: 'contrat formateur', pluriel: 'Contrats formateur' },
  rapports_session: { article: 'le', nom: 'bilan de session', pluriel: 'Bilans de session' },
  devis: { article: 'le', nom: 'devis', pluriel: 'Devis' },
  conventions: { article: 'la', nom: 'convention', pluriel: 'Conventions' },
  dossiers_formation: { article: 'le', nom: 'dossier de formation', pluriel: 'Dossiers de formation' },
  factures: { article: 'la', nom: 'facture', pluriel: 'Factures' },
  paiements: { article: 'le', nom: 'paiement', pluriel: 'Paiements' },
  poei: { article: 'le', nom: 'parcours POEI', pluriel: 'POEI' },
  poei_candidats: { article: 'le', nom: 'candidat POEI', pluriel: 'Candidats POEI' },
  poei_interventions: { article: "l'", nom: 'intervention POEI', pluriel: 'Interventions POEI' },
  poei_plannings: { article: 'le', nom: 'planning POEI', pluriel: 'Plannings POEI' },
  documents: { article: 'le', nom: 'document', pluriel: 'Documents' },
  users: { article: "l'", nom: 'utilisateur', pluriel: 'Utilisateurs' },
  franchises: { article: 'la', nom: 'franchise', pluriel: 'Franchises' },
  commissions_sessions: { article: 'la', nom: 'commission', pluriel: 'Commissions' },
  evaluations_apprenant: { article: "l'", nom: 'évaluation', pluriel: 'Évaluations' },
}

export const OPERATIONS_ACTIVITE: Record<OperationActivite, { verbe: string; libelle: string; classe: string }> = {
  insert: { verbe: 'a créé', libelle: 'Création', classe: 'bg-success-50 text-success-600 border-success-100' },
  update: { verbe: 'a modifié', libelle: 'Modification', classe: 'bg-info-50 text-info-600 border-info-100' },
  delete: { verbe: 'a supprimé', libelle: 'Suppression', classe: 'bg-danger-50 text-danger-700 border-danger-100' },
}

/** Noms de colonnes lisibles ; à défaut, le nom technique sans underscores. */
const CHAMPS: Record<string, string> = {
  status: 'statut', statut: 'statut', montant_ht: 'montant HT', montant_ttc: 'montant TTC', montant_paye: 'montant payé',
  montant_restant: 'reste à payer', date_debut: 'date de début', date_fin: 'date de fin', date_emission: "date d'émission",
  date_echeance: "date d'échéance", prix_ht: 'prix HT', raison_sociale: 'raison sociale', nom_commercial: 'nom commercial',
  formateur_id: 'formateur', client_id: 'client', formation_id: 'formation', session_id: 'session', opco_id: 'OPCO',
  notes: 'notes', notes_internes: 'notes internes', email: 'email', telephone: 'téléphone', adresse: 'adresse',
  code_postal: 'code postal', ville: 'ville', siret: 'SIRET', assigned_to: 'assignation', role: 'rôle',
  is_active: 'actif', sans_affacturage: 'sans affacturage', affacturage_status: 'affacturage',
  opco_compte_status: 'compte OPCO', opco_compte_date: 'date du compte OPCO', opco_compte_identifiant: 'identifiant OPCO',
  opco_compte_chiffre: 'mot de passe OPCO', duree_heures: 'durée (h)', lieu: 'lieu', intitule: 'intitulé',
  date_naissance: 'date de naissance', statut_paiement: 'statut de paiement', taux_commission: 'taux de commission',
  date_partenariat: 'date de partenariat', numero_dossier_opco: 'dossier OPCO', montant_finance_opco: 'montant financé',
}
export function libelleChamp(c: string): string {
  return CHAMPS[c] || c.replace(/_/g, ' ')
}

/** Valeur affichable d'une colonne (dates, montants, booléens, objets). */
export function formatValeur(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'vide'
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (typeof v === 'number') return v.toLocaleString('fr-FR')
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00').toLocaleDateString('fr-FR')
    return v.length > 80 ? v.slice(0, 77) + '…' : v
  }
  if (Array.isArray(v)) return v.length ? `${v.length} élément${v.length > 1 ? 's' : ''}` : 'vide'
  return 'objet'
}

/** Où ouvrir la fiche concernée par une activité, quand une page existe. */
export function lienActivite(a: Pick<Activite, 'table_name' | 'record_id' | 'avant' | 'apres'>): string | null {
  const j = (a.apres || a.avant || {}) as Record<string, any>
  const id = a.record_id
  switch (a.table_name) {
    case 'clients': return id ? `/dashboard/clients/${id}` : null
    case 'contacts': return j.client_id ? `/dashboard/clients/${j.client_id}` : null
    case 'leads': return '/dashboard/leads'
    case 'apporteurs_affaires': return '/dashboard/apporteurs'
    case 'apprenants': return id ? `/dashboard/apprenants/${id}` : null
    case 'formateurs': return id ? `/dashboard/formateurs/${id}` : null
    case 'formations': return id ? `/dashboard/formations/${id}` : null
    case 'sessions': return id ? `/dashboard/sessions/${id}` : null
    case 'inscriptions': case 'session_frais': case 'contrats_formateur': case 'rapports_session': case 'evaluations_apprenant':
      return j.session_id ? `/dashboard/sessions/${j.session_id}` : null
    case 'commissions_sessions': return j.franchise_id ? `/dashboard/franchises/${j.franchise_id}` : null
    case 'devis': return '/dashboard/devis'
    case 'conventions': return '/dashboard/conventions'
    case 'dossiers_formation': return '/dashboard/dossiers'
    case 'factures': return '/dashboard/factures'
    case 'paiements': return '/dashboard/factures'
    case 'poei': return id ? `/dashboard/poei/${id}` : null
    case 'poei_candidats': case 'poei_interventions': case 'poei_plannings':
      return j.poei_id ? `/dashboard/poei/${j.poei_id}` : null
    case 'documents':
      return j.session_id ? `/dashboard/sessions/${j.session_id}` : j.client_id ? `/dashboard/clients/${j.client_id}` : '/dashboard/documents'
    case 'users': return '/dashboard/users'
    case 'franchises': return id ? `/dashboard/franchises/${id}` : null
    default: return null
  }
}

/** Nom affiché d'un utilisateur du journal : le compte s'il existe encore, sinon le nom figé à l'écriture. */
export function nomActeur(a: Activite): string {
  const u = a.acteur
  const nom = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : ''
  if (nom) return nom
  if (a.acteur_nom) return a.acteur_nom
  if (a.acteur_email) return a.acteur_email
  if (a.acteur_id) return u?.email || 'Utilisateur supprimé'
  return 'Système'
}

/** audit_logs nomme l'entité au singulier ('session', 'client'), le journal par table ('sessions'). */
const ENTITE_VERS_TABLE: Record<string, string> = {
  client: 'clients', contact: 'contacts', lead: 'leads', apporteur: 'apporteurs_affaires', apprenant: 'apprenants',
  formateur: 'formateurs', formation: 'formations', session: 'sessions', inscription: 'inscriptions',
  contrat_formateur: 'contrats_formateur', rapport_session: 'rapports_session', convention: 'conventions',
  dossier_formation: 'dossiers_formation', dossier: 'dossiers_formation', facture: 'factures', paiement: 'paiements',
  poei_candidat: 'poei_candidats', poei_intervention: 'poei_interventions', poei_planning: 'poei_plannings',
  document: 'documents', user: 'users', franchise: 'franchises', commission_session: 'commissions_sessions',
  evaluation_apprenant: 'evaluations_apprenant', devis: 'devis', poei: 'poei',
}
export function tableDepuisEntite(entityType: string): string {
  return ENTITE_VERS_TABLE[entityType] || entityType
}
/** Toutes les valeurs d'entity_type d'audit_logs qui correspondent à une table du journal. */
export function entitesPourTable(table: string): string[] {
  return [table, ...Object.entries(ENTITE_VERS_TABLE).filter(([, t]) => t === table).map(([e]) => e)]
}

/** « a modifié la facture FA-2026-0245 » */
export function phraseActivite(a: Activite): { verbe: string; objet: string; libelle: string } {
  const t = TABLES_ACTIVITE[a.table_name] || { article: 'la', nom: `ligne ${a.table_name}`, pluriel: a.table_name }
  const op = OPERATIONS_ACTIVITE[a.operation]
  return { verbe: op.verbe, objet: `${t.article}${t.article.endsWith("'") ? '' : ' '}${t.nom}`, libelle: a.libelle || '' }
}

/** Libellés résolus des fiches référencées (uuid → texte lisible), calculés côté serveur. */
export type Libelles = Record<string, string>

/** Colonnes qui résument une fiche à sa création ou à sa suppression. */
export const CHAMPS_CLES: Record<string, string[]> = {
  clients: ['raison_sociale', 'nom_commercial', 'siret', 'ville', 'email', 'telephone', 'opco_id', 'type'],
  contacts: ['prenom', 'nom', 'email', 'telephone', 'poste', 'client_id'],
  leads: ['nom', 'prenom', 'entreprise', 'email', 'telephone', 'statut', 'status', 'valeur', 'montant_estime'],
  apporteurs_affaires: ['raison_sociale', 'nom', 'prenom', 'email', 'categorie'],
  apprenants: ['prenom', 'nom', 'email', 'telephone', 'date_naissance', 'entreprise', 'client_id'],
  formateurs: ['prenom', 'nom', 'email', 'telephone', 'tarif_journalier'],
  formations: ['intitule', 'reference', 'duree_heures', 'categorie', 'modalite'],
  sessions: ['intitule', 'reference', 'formation_id', 'client_id', 'formateur_id', 'date_debut', 'date_fin', 'lieu', 'ville', 'prix_ht', 'status', 'type_session'],
  inscriptions: ['apprenant_id', 'session_id', 'status', 'date_inscription'],
  session_formations: ['session_id', 'formation_id', 'ordre'],
  session_frais: ['session_id', 'libelle', 'montant', 'type'],
  contrats_formateur: ['numero', 'session_id', 'formateur_id', 'montant_ht', 'status'],
  rapports_session: ['session_id', 'formateur_id', 'status'],
  devis: ['numero', 'client_id', 'montant_ttc', 'status', 'date_emission'],
  devis_lignes: ['designation', 'quantite', 'prix_unitaire_ht', 'montant_ht'],
  conventions: ['numero', 'client_id', 'session_id', 'montant_ttc', 'status'],
  dossiers_formation: ['numero', 'client_id', 'status'],
  factures: ['numero', 'client_id', 'session_id', 'montant_ttc', 'status', 'date_emission', 'financeur_type', 'sans_affacturage'],
  facture_lignes: ['designation', 'quantite', 'prix_unitaire_ht', 'montant_ht'],
  paiements: ['montant', 'mode', 'date_paiement', 'status', 'facture_id'],
  poei: ['numero', 'client_id', 'formation_id', 'date_debut', 'date_fin', 'duree_heures', 'statut'],
  poei_candidats: ['apprenant_id', 'poei_id', 'statut', 'date_debut', 'date_fin', 'duree_heures'],
  poei_interventions: ['libelle', 'poei_id', 'formateur_id', 'date_debut', 'date_fin', 'nb_heures', 'statut'],
  poei_plannings: ['poei_id', 'candidat_id', 'date', 'type'],
  documents: ['type', 'file_name', 'session_id', 'client_id', 'apprenant_id'],
  users: ['first_name', 'last_name', 'email', 'role', 'status'],
  franchises: ['nom', 'raison_sociale', 'taux_commission', 'commission_type', 'date_partenariat'],
  commissions_sessions: ['franchise_id', 'session_id', 'montant', 'statut', 'status'],
  evaluations_apprenant: ['apprenant_id', 'session_id', 'intitule', 'note', 'note_max'],
}

/** Colonnes qui référencent une fiche : leur uuid s'affiche par son libellé. */
const COLONNES_REFERENCE = /_id$|^(created_by|assigned_to|updated_by|realise_par|annulee_par)$/

/** Valeur affichable, avec les identifiants remplacés par le nom de la fiche visée. */
export function formatValeurLisible(cle: string, v: unknown, libelles?: Libelles): string {
  if (typeof v === 'string' && libelles && (COLONNES_REFERENCE.test(cle) || /^[0-9a-f-]{36}$/i.test(v))) {
    const l = libelles[v]
    if (l) return l
  }
  return formatValeur(v)
}

/** Pièces d'un événement applicatif rendues lisibles. */
export interface PhraseEvenement {
  verbe: string
  /** Complément déjà résolu (nom de la fiche, destinataire…), affiché en gras. */
  objet: string | null
  /** Précisions à afficher en petit, déjà formulées. */
  precisions: string[]
}

const ENTITES_LIBELLE: Record<string, string> = {
  session: 'la session', client: 'le client', apprenant: "l'apprenant", facture: 'la facture', poei: 'le parcours POEI',
  convention: 'la convention', contrat_formateur: 'le contrat formateur', formateur: 'le formateur', user: "l'utilisateur",
  lead: 'le lead', document: 'le document', contact: 'le contact', franchise: 'la franchise', formation: 'la formation',
  candidat_vivier: 'le candidat du vivier', poei_candidat: 'le candidat POEI', inscription: "l'inscription",
  certificat_signature: 'le certificat de réalisation', recueil_besoin: 'le recueil des besoins', poei_grille: "la grille d'évaluation POEI",
  pointage: 'le pointage', organization: "l'organisme", crm_tache: 'la tâche', lead_formation: 'la formation du lead',
  demande_changement: 'la demande de changement', dpo: 'la charte de protection des données', facture_formateur: 'la facture formateur',
}

const lib = (libelles: Libelles | undefined, id: unknown) => (typeof id === 'string' && libelles?.[id]) || null
const nb = (n: unknown, sing: string, plur = `${sing}s`) => `${Number(n) || 0} ${Number(n) === 1 ? sing : plur}`
const euro = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR')} €`

/**
 * Traduit une ligne d'audit_logs (action technique + détails JSON) en une
 * phrase complète : « a envoyé la convention à la signature pour la session
 * HYGIÈNE ALIMENTAIRE (CS BORDEAUX) ».
 */
export function phraseEvenement(action: string, entityType: string, entityId: string | null, details: Record<string, unknown> | null, libelles?: Libelles): PhraseEvenement {
  const d = details || {}
  const cible = lib(libelles, entityId)
  const entite = ENTITES_LIBELLE[entityType] || `la fiche ${entityType.replace(/_/g, ' ')}`
  const objetDefaut = cible ? `${entite} ${cible}` : entite
  const session = lib(libelles, d.session_id ?? d.sessionId ?? d.session)
  const apprenant = lib(libelles, d.apprenant_id)
  const client = lib(libelles, d.client_id ?? d.clientId)
  const poei = lib(libelles, d.poei_id ?? d.poei)
  const precisions: string[] = []
  const p = (s: string | null | undefined) => { if (s) precisions.push(s) }

  switch (action) {
    case 'create': {
      const r: PhraseEvenement = { verbe: 'a créé', objet: objetDefaut, precisions }
      if (entityType === 'session') { p(client ? `pour ${client}` : null); p(d.apprenants != null ? nb(d.apprenants, 'apprenant') + ' inscrits' : null); p(d.via === 'dossier_complet' ? 'depuis un nouveau dossier' : null) }
      if (entityType === 'facture') { p(session ? `session ${session}` : null); p(d.directe ? 'adressée directement à l’entreprise' : d.opco ? `adressée à l’OPCO ${lib(libelles, d.opco) || ''}`.trim() : null); p(d.sans_affacturage ? 'sans affacturage' : null) }
      if (entityType === 'document') { p(d.piece ? `pièce : ${String(d.piece).replace(/_/g, ' ')}` : null); p(session ? `session ${session}` : null); p(d.numero_lu ? `numéro lu : ${d.numero_lu}` : null) }
      return r
    }
    case 'update': {
      const r: PhraseEvenement = { verbe: 'a modifié', objet: objetDefaut, precisions }
      if (d.financement_opco) p('financement OPCO renseigné')
      if (d.numero_engagement) p(`numéro d’engagement ${d.numero_engagement}`)
      if (d.version) p(`version ${d.version}`)
      if (d.compte_opco && typeof d.compte_opco === 'object') {
        const c = d.compte_opco as Record<string, unknown>
        p(c.opco_compte_status ? `compte OPCO : ${String(c.opco_compte_status).replace(/_/g, ' ')}` : null)
        p(c.opco_compte_date ? `date ${formatValeur(c.opco_compte_date)}` : null)
        p(c.opco_compte_identifiant ? `identifiant ${c.opco_compte_identifiant}` : null)
        p(c.opco_compte_chiffre ? `mot de passe ${c.opco_compte_chiffre}` : null)
      }
      return r
    }
    case 'delete': {
      const r: PhraseEvenement = { verbe: 'a supprimé', objet: cible ? `${entite} ${cible}` : d.numero ? `${entite} ${d.numero}` : entite, precisions }
      p(d.motif ? `motif : ${d.motif}` : null)
      return r
    }
    case 'inscription': return { verbe: 'a inscrit', objet: apprenant, precisions: [session ? `à la session ${session}` : ''].filter(Boolean) }
    case 'desinscription': return { verbe: 'a désinscrit', objet: apprenant, precisions: [cible ? `de la session ${cible}` : ''].filter(Boolean) }
    case 'valider_candidat_vivier': return { verbe: 'a validé le candidat', objet: apprenant, precisions: [poei ? `pour le parcours ${poei}` : ''].filter(Boolean) }
    case 'add_candidat': return { verbe: 'a ajouté un candidat', objet: cible ? `au parcours ${cible}` : null, precisions }
    case 'add_intervention': return { verbe: 'a ajouté une intervention', objet: cible ? `au parcours ${cible}` : null, precisions }
    case 'accept_mission': return { verbe: 'a accepté la mission', objet: cible ? `sur la session ${cible}` : null, precisions }
    case 'accept_poei_intervention': return { verbe: 'a accepté son intervention', objet: cible ? `sur le parcours ${cible}` : null, precisions }
    case 'pointer_arrivee': return { verbe: 'a pointé son arrivée', objet: session ? `sur la session ${session}` : null, precisions: [d.heure ? `à ${d.heure}` : ''].filter(Boolean) }
    case 'pointer_depart': return { verbe: 'a pointé son départ', objet: session ? `de la session ${session}` : null, precisions: [d.heure ? `à ${d.heure}` : ''].filter(Boolean) }
    case 'update_prix_session': return { verbe: 'a fixé le prix de la session', objet: cible, precisions: [d.montant != null ? `à ${euro(d.montant)} HT` : ''].filter(Boolean) }
    case 'update_cout_formateur': return { verbe: 'a fixé la rémunération du formateur', objet: cible ? `sur la session ${cible}` : null, precisions: [d.montant != null ? `à ${euro(d.montant)}` : ''].filter(Boolean) }
    case 'commission_session_validee': return { verbe: 'a validé la commission franchise', objet: cible ? `de la session ${cible}` : null, precisions }
    case 'generate_signature_link': return { verbe: 'a généré un lien de signature', objet: cible ? `pour la convention ${cible}` : null, precisions }
    case 'send_convention_signature': return { verbe: 'a envoyé la convention à la signature', objet: cible ? `(${cible})` : null, precisions: [session ? `session ${session}` : ''].filter(Boolean) }
    case 'send_convention_inter': return { verbe: 'a envoyé la convention inter-entreprises', objet: client, precisions: [session ? `session ${session}` : ''].filter(Boolean) }
    case 'sign_convention': return { verbe: 'a signé la convention', objet: cible, precisions: [d.signataire ? `signataire : ${d.signataire}` : ''].filter(Boolean) }
    case 'send_contrat_signature': return { verbe: 'a envoyé le contrat formateur à la signature', objet: cible, precisions: [session ? `session ${session}` : ''].filter(Boolean) }
    case 'sign_contrat_formateur': return { verbe: 'a signé le contrat formateur', objet: cible, precisions: [d.signataire ? `signataire : ${d.signataire}` : ''].filter(Boolean) }
    case 'send_signature': return { verbe: 'a envoyé le certificat de réalisation à la signature', objet: cible, precisions }
    case 'send_signature_employeur': return { verbe: 'a envoyé le document à signer à l’employeur', objet: cible ? `(${cible})` : null, precisions: [d.email ? `à ${d.email}` : ''].filter(Boolean) }
    case 'save': {
      if (entityType === 'recueil_besoin') return { verbe: 'a enregistré le recueil des besoins', objet: cible, precisions: [d.statut === 'complete' ? 'complet' : d.statut ? String(d.statut) : ''].filter(Boolean) }
      if (entityType === 'poei_grille') return { verbe: 'a enregistré une grille d’évaluation', objet: poei ? `du parcours ${poei}` : null, precisions: [d.statut === 'validee' ? 'validée' : d.statut ? String(d.statut) : '', d.semaine ? `semaine ${d.semaine}` : ''].filter(Boolean) }
      return { verbe: 'a enregistré', objet: objetDefaut, precisions }
    }
    case 'generate_devis_poei': return { verbe: 'a généré les devis du parcours', objet: cible, precisions: [nb(d.created, 'créé'), nb(d.updated, 'mis à jour', 'mis à jour'), nb(d.skipped, 'ignoré')] }
    case 'generate_factures_poei': return { verbe: 'a généré les factures du parcours', objet: cible, precisions: [nb(d.created, 'créée'), nb(d.updated, 'mise à jour', 'mises à jour'), nb(d.skipped, 'ignorée')] }
    case 'generate_devis_previsionnel_poei': return { verbe: 'a généré le devis prévisionnel du parcours', objet: cible, precisions: [d.places != null ? nb(d.places, 'place') : ''].filter(Boolean) }
    case 'poei_planning_genere': return { verbe: 'a généré le planning du parcours', objet: cible, precisions: [d.candidats != null ? nb(d.candidats, 'candidat') : '', d.jours != null ? nb(d.jours, 'journée') : '', Array.isArray(d.periode) ? `du ${formatValeur(d.periode[0])} au ${formatValeur(d.periode[1])}` : ''].filter(Boolean) }
    case 'send_group_email_poei': return { verbe: 'a envoyé un mail groupé aux candidats', objet: cible ? `du parcours ${cible}` : null, precisions: [nb(d.sent, 'envoyé'), Number(d.skipped) ? nb(d.skipped, 'ignoré') : ''].filter(Boolean) }
    case 'send_mandat_poei': return { verbe: 'a envoyé le mandat POEI', objet: cible ? `du parcours ${cible}` : null, precisions: [d.email ? `à ${d.email}` : ''].filter(Boolean) }
    case 'send_hygiene_poei': return { verbe: 'a envoyé les attestations d’hygiène', objet: cible ? `du parcours ${cible}` : null, precisions: [d.candidats != null ? nb(d.candidats, 'candidat') : '', d.heures ? `${d.heures} h` : '', d.referent ? `au référent ${d.referent}` : ''].filter(Boolean) }
    case 'send_hygiene_referent': return { verbe: 'a envoyé les attestations d’hygiène', objet: cible ? `de la session ${cible}` : null, precisions: [d.documents != null ? nb(d.documents, 'document') : '', d.referent ? `au référent ${d.referent}` : ''].filter(Boolean) }
    case 'send_evaluation_formateur': return { verbe: 'a envoyé l’évaluation du formateur au référent', objet: cible ? `(parcours ${cible})` : null, precisions: [d.referent ? String(d.referent) : '', nb(d.sent, 'questionnaire')].filter(Boolean) }
    case 'send_convocation_referent': return { verbe: 'a envoyé la convocation au référent', objet: cible ? `de la session ${cible}` : null, precisions: [d.email ? String(d.email) : ''].filter(Boolean) }
    case 'send_access': return { verbe: 'a envoyé ses accès', objet: cible ? `au formateur ${cible}` : null, precisions }
    case 'send_audit_access': return { verbe: 'a envoyé l’accès à l’outil d’audit', objet: cible ? `au formateur ${cible}` : null, precisions: [d.email ? String(d.email) : ''].filter(Boolean) }
    case 'send_email': return { verbe: 'a envoyé un mail', objet: (d.to as string) || cible, precisions: [d.subject ? `« ${d.subject} »` : ''].filter(Boolean) }
    case 'start_impersonation': return { verbe: 's’est connecté en tant que', objet: cible, precisions }
    case 'invite': return { verbe: 'a invité', objet: (d.email as string) || cible, precisions: [d.role ? `rôle ${d.role}` : '', d.email_sent === false ? 'mail non envoyé' : ''].filter(Boolean) }
    case 'invite_franchise': return { verbe: 'a invité la franchise', objet: cible, precisions: [d.email ? String(d.email) : ''].filter(Boolean) }
    case 'confirm_date': return { verbe: 'a confirmé la date de formation', objet: cible, precisions: [session ? `session ${session}` : ''].filter(Boolean) }
    case 'generate_convention': return { verbe: 'a généré la convention', objet: client ? `pour ${client}` : null, precisions: [d.apprenants != null ? nb(d.apprenants, 'apprenant') : ''].filter(Boolean) }
    case 'convert': return { verbe: 'a converti le lead en client', objet: client || cible, precisions }
    case 'validate_change': return { verbe: 'a validé une demande de changement de participant', objet: cible, precisions }
    case 'sign': return { verbe: entityType === 'dpo' ? 'a signé la charte de protection des données' : 'a signé', objet: entityType === 'dpo' ? null : cible, precisions: [d.version ? `version ${d.version}` : ''].filter(Boolean) }
    case 'move': return { verbe: 'a déplacé la tâche', objet: cible, precisions: [d.from && d.to ? `de « ${String(d.from).replace(/_/g, ' ')} » à « ${String(d.to).replace(/_/g, ' ')} »` : ''].filter(Boolean) }
    case 'upload_tampon': return { verbe: 'a déposé le tampon de l’organisme', objet: null, precisions }
    case 'update_facture_formateur': return { verbe: 'a mis à jour la facture formateur', objet: cible, precisions: [d.status ? `statut ${String(d.status)}` : ''].filter(Boolean) }
    case 'reveal_opco_secret': return { verbe: 'a consulté le mot de passe OPCO', objet: cible ? `du client ${cible}` : null, precisions }
    case 'rekey_opco_secret': return { verbe: 'a rechiffré le mot de passe OPCO', objet: cible ? `du client ${cible}` : null, precisions }
    case 'annulation_activite': return { verbe: 'a annulé une activité du journal', objet: objetDefaut, precisions: [d.operation ? OPERATIONS_ACTIVITE[d.operation as OperationActivite]?.libelle.toLowerCase() || '' : '', Array.isArray(d.champs) && d.champs.length ? `champs : ${(d.champs as string[]).map(libelleChamp).join(', ')}` : ''].filter(Boolean) }
    case 'envoi_positionnement': return { verbe: 'a envoyé le questionnaire de positionnement', objet: cible ? `du parcours ${cible}` : null, precisions: [d.envoyes != null ? nb(d.envoyes, 'candidat') : ''].filter(Boolean) }
    case 'login': return { verbe: 's’est connecté', objet: null, precisions }
    case 'export': return { verbe: 'a exporté', objet: objetDefaut, precisions }
    default: {
      // Inconnu : verbe déduit du code, détails scalaires en précisions
      for (const [k, v] of Object.entries(d)) if (v !== null && typeof v !== 'object') precisions.push(`${k.replace(/_/g, ' ')} : ${formatValeurLisible(k, v, libelles)}`)
      return { verbe: `a effectué « ${action.replace(/_/g, ' ')} »`, objet: objetDefaut, precisions }
    }
  }
}
