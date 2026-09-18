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
