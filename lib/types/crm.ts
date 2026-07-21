// ============================================================
// Types Module 2 — CRM Commercial
// ============================================================

import type { BadgeVariant } from '@/lib/types'

export type LeadStatus =
  | 'nouveau'
  | 'contacte'
  | 'qualification'
  | 'proposition_envoyee'
  | 'negociation'
  | 'gagne'
  | 'perdu'

export type LeadValidationStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export const LEAD_VALIDATION_STATUS_LABELS: Record<LeadValidationStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente de validation',
  approved: 'Validé',
  rejected: 'Refusé',
}

export type LeadSource =
  | 'site_web'
  | 'apporteur_affaires'
  | 'phoning'
  | 'salon'
  | 'bouche_a_oreille'
  | 'reseaux_sociaux'
  | 'email_entrant'
  | 'partenaire'
  | 'ancien_client'
  | 'autre'

export type ClientType = 'entreprise' | 'particulier'

export type FinanceurType =
  | 'opco' | 'entreprise' | 'france_travail' | 'cpf'
  | 'fonds_propres' | 'region' | 'autre'

export type InteractionType = 'appel' | 'email' | 'rdv' | 'note' | 'relance' | 'autre'

// ---- Entités ----

export interface Lead {
  id: string
  organization_id: string
  type: ClientType
  // Entreprise (mirror clients)
  entreprise: string | null
  siret: string | null
  sigle: string | null
  code_naf: string | null
  secteur_activite: string | null
  taille_entreprise: string | null
  forme_juridique: string | null
  date_creation_entreprise: string | null
  effectif_libelle: string | null
  tva_intra: string | null
  est_qualiopi: boolean
  est_organisme_formation: boolean
  adresse: string | null
  code_postal: string | null
  ville: string | null
  site_web: string | null
  // Contact principal
  contact_civilite: string | null
  contact_nom: string
  contact_prenom: string | null
  contact_email: string | null
  contact_telephone: string | null
  contact_poste: string | null
  contact_qualite: string | null
  // Source & status
  source: LeadSource
  status: LeadStatus
  score: number
  // Financement / OPCO
  financeur_type: FinanceurType | null
  opco_id: string | null
  opco_compte_status: 'aucun' | 'courrier_envoye' | 'en_attente_validation' | 'actif' | 'inactif' | null
  code_idcc: string | null
  convention_collective: string | null
  numero_opco: string | null
  // Recueil du besoin
  montant_estime: number | null
  formation_souhaitee: string | null
  nombre_stagiaires: number | null
  date_souhaitee: string | null
  date_fin_souhaitee: string | null
  commentaire: string | null
  // Planification (workflow commercial)
  formation_id: string | null
  formateur_id: string | null
  date_confirmee: string | null
  session_id: string | null
  planification_status: string | null
  // Suivi
  apporteur_id: string | null
  assigned_to: string | null
  converted_client_id: string | null
  converted_at: string | null
  lost_reason: string | null
  tags: string[]
  next_action: string | null
  next_action_date: string | null
  // Workflow validation
  validation_status: LeadValidationStatus
  submitted_at: string | null
  submitted_by: string | null
  validated_at: string | null
  validated_by: string | null
  validation_comment: string | null
  gestionnaire_id: string | null
  created_at: string
  updated_at: string
  // Joined fields
  assigned_user?: { first_name: string; last_name: string }
  submitted_user?: { first_name: string; last_name: string }
  validated_user?: { first_name: string; last_name: string }
  gestionnaire?: { first_name: string; last_name: string }
  apporteur?: { nom: string; prenom: string | null }
  _interactions_count?: number
}

export interface LeadInteraction {
  id: string
  organization_id: string
  lead_id: string
  type: InteractionType
  subject: string | null
  content: string | null
  date: string
  duration_minutes: number | null
  user_id: string | null
  created_at: string
  user?: { first_name: string; last_name: string }
}

export interface Client {
  id: string
  organization_id: string
  type: ClientType
  raison_sociale: string | null
  siret: string | null
  code_naf: string | null
  secteur_activite: string | null
  taille_entreprise: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string
  telephone: string | null
  whatsapp: string | null
  whatsapp_opt_in: boolean
  email: string | null
  site_web: string | null
  financeur_type: FinanceurType | null
  numero_opco: string | null
  opco_id: string | null
  opco_compte_status: 'aucun' | 'courrier_envoye' | 'en_attente_validation' | 'actif' | 'inactif' | null
  code_idcc: string | null
  convention_collective: string | null
  sigle: string | null
  forme_juridique: string | null
  date_creation_entreprise: string | null
  effectif_libelle: string | null
  tva_intra: string | null
  est_qualiopi: boolean
  est_organisme_formation: boolean
  civilite: string | null
  nom: string | null
  prenom: string | null
  date_naissance: string | null
  tags: string[]
  notes: string | null
  score: number
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Virtual
  _contacts_count?: number
  _display_name?: string
  assigned_user?: { first_name: string | null; last_name: string | null } | null
}

export interface Contact {
  id: string
  organization_id: string
  client_id: string | null
  civilite: string | null
  prenom: string
  nom: string
  email: string | null
  telephone: string | null
  mobile: string | null
  poste: string | null
  service: string | null
  est_principal: boolean
  est_signataire: boolean
  est_referent_formation: boolean
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // Joined
  client?: { raison_sociale: string | null; type: ClientType }
}

export interface ApporteurAffaires {
  id: string
  organization_id: string
  type: ClientType
  raison_sociale: string | null
  siret: string | null
  nom: string
  prenom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  taux_commission: number
  commission_fixe: number | null
  mode_calcul: string
  conditions: string | null
  is_active: boolean
  date_debut_contrat: string | null
  date_fin_contrat: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Virtual
  _leads_count?: number
  _total_commissions?: number
}

export interface Commission {
  id: string
  organization_id: string
  apporteur_id: string
  lead_id: string | null
  montant_base: number
  taux_applique: number | null
  montant_commission: number
  status: 'en_attente' | 'validee' | 'payee'
  date_validation: string | null
  date_paiement: string | null
  reference_paiement: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---- Labels & couleurs ----

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  qualification: 'Qualification',
  proposition_envoyee: 'Proposition envoyée',
  negociation: 'Négociation',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, BadgeVariant> = {
  nouveau: 'info',
  contacte: 'default',
  qualification: 'warning',
  proposition_envoyee: 'warning',
  negociation: 'info',
  gagne: 'success',
  perdu: 'danger',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  site_web: 'Site web',
  apporteur_affaires: 'Apporteur d\'affaires',
  phoning: 'Phoning',
  salon: 'Salon / Événement',
  bouche_a_oreille: 'Bouche-à-oreille',
  reseaux_sociaux: 'Réseaux sociaux',
  email_entrant: 'Email entrant',
  partenaire: 'Partenaire',
  ancien_client: 'Ancien client',
  autre: 'Autre',
}

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  entreprise: 'Entreprise',
  particulier: 'Particulier',
}

export const FINANCEUR_LABELS: Record<FinanceurType, string> = {
  opco: 'OPCO',
  entreprise: 'Entreprise',
  france_travail: 'France Travail',
  cpf: 'CPF',
  fonds_propres: 'Fonds propres',
  region: 'Région',
  autre: 'Autre',
}

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  appel: 'Appel',
  email: 'Email',
  rdv: 'Rendez-vous',
  note: 'Note',
  relance: 'Relance',
  autre: 'Autre',
}

export const PIPELINE_COLUMNS: LeadStatus[] = [
  'nouveau',
  'contacte',
  'qualification',
  'proposition_envoyee',
  'negociation',
  'gagne',
  'perdu',
]
