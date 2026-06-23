// ============================================================
// Types Module 3 — Formations, Sessions, Formateurs, Apprenants
// ============================================================

import type { BadgeVariant } from '@/lib/types'

export type ModaliteFormation = 'presentiel' | 'distanciel' | 'mixte'
export type SessionStatus = 'planifiee' | 'confirmee' | 'en_cours' | 'terminee' | 'annulee'
export type SessionType = 'inter' | 'intra'
export type SessionModalite = 'presentiel' | 'distanciel' | 'mixte'

export interface HoraireJour {
  date: string
  matin_debut: string
  matin_fin: string
  aprem_debut: string
  aprem_fin: string
}
export type InscriptionStatus = 'pre_inscrit' | 'inscrit' | 'confirme' | 'en_cours' | 'complete' | 'abandonne' | 'annule'

export interface Formation {
  id: string
  organization_id: string
  reference: string | null
  intitule: string
  sous_titre: string | null
  categorie: string | null
  objectifs_pedagogiques: string[]
  prerequis: string | null
  public_vise: string | null
  programme_detaille: string | null
  competences_visees: string[]
  modalite: ModaliteFormation
  duree_heures: number
  duree_jours: number | null
  nombre_sessions_prevu: number
  methodes_pedagogiques: string | null
  moyens_techniques: string | null
  modalites_evaluation: string | null
  accessibilite_handicap: string | null
  referent_handicap: string | null
  tarif_inter_ht: number | null
  tarif_intra_ht: number | null
  tarif_individuel_ht: number | null
  tva_applicable: boolean
  taux_tva: number
  taux_satisfaction: number | null
  taux_reussite: number | null
  taux_insertion: number | null
  nombre_apprenants_total: number
  version: number
  date_derniere_maj: string
  est_certifiante: boolean
  code_rncp: string | null
  code_rs: string | null
  certificateur: string | null
  is_active: boolean
  modalites_admission: string | null
  is_published: boolean
  is_poei?: boolean
  tags: string[]
  created_at: string
  updated_at: string
  // Virtual
  _sessions_count?: number
}

export interface Formateur {
  id: string
  organization_id: string
  user_id: string | null
  civilite: string | null
  prenom: string
  nom: string
  email: string | null
  telephone: string | null
  cv_url: string | null
  qualifications: string | null
  domaines_expertise: string[]
  certifications: string[]
  date_derniere_habilitation: string | null
  prochaine_mise_a_jour: string | null
  type_contrat: string
  siret: string | null
  tarif_journalier: number | null
  tarif_horaire: number | null
  note_moyenne: number | null
  nombre_evaluations: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Apprenant {
  id: string
  organization_id: string
  user_id: string | null
  client_id: string | null
  civilite: string | null
  prenom: string
  nom: string
  email: string | null
  telephone: string | null
  date_naissance: string | null
  entreprise: string | null
  poste: string | null
  situation_handicap: boolean
  type_handicap: string | null
  besoins_adaptation: string | null
  referent_handicap_contacte: boolean
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // Joined
  client?: { raison_sociale: string | null }
  _inscriptions_count?: number
}

export interface Session {
  id: string
  organization_id: string
  formation_id: string
  type_session: SessionType
  modalite: SessionModalite
  client_id: string | null
  horaires_jours: HoraireJour[]
  reference: string | null
  intitule: string | null
  date_debut: string
  date_fin: string
  horaires: string | null
  lieu: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  lien_visio: string | null
  places_min: number
  places_max: number
  formateur_id: string | null
  status: SessionStatus
  cout_formateur: number | null
  cout_salle: number | null
  cout_materiel: number | null
  notes_internes: string | null
  notes_logistiques: string | null
  created_at: string
  updated_at: string
  // Joined
  formation?: Pick<Formation, 'intitule' | 'duree_heures' | 'modalite' | 'reference'>
  formateur?: Pick<Formateur, 'prenom' | 'nom'>
  _nb_inscrits?: number
  _places_restantes?: number
}

export interface Inscription {
  id: string
  organization_id: string
  session_id: string
  apprenant_id: string
  status: InscriptionStatus
  date_inscription: string
  financeur_type: string | null
  financeur_nom: string | null
  montant_pris_en_charge: number | null
  heures_presence: number
  taux_assiduite: number
  note_evaluation_entree: number | null
  note_evaluation_sortie: number | null
  progression: number | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  apprenant?: Pick<Apprenant, 'prenom' | 'nom' | 'email' | 'entreprise'>
  session?: Pick<Session, 'date_debut' | 'date_fin' | 'reference'>
}

export interface Emargement {
  id: string
  session_id: string
  apprenant_id: string
  date: string
  creneau: string
  heure_debut: string | null
  heure_fin: string | null
  est_present: boolean
  signed_at: string | null
  token: string
  created_at: string
}

// ---- Labels ----

export const MODALITE_LABELS: Record<ModaliteFormation, string> = {
  presentiel: 'Présentiel',
  distanciel: 'Distanciel',
  mixte: 'Mixte',
}

export const MODALITE_COLORS: Record<ModaliteFormation, BadgeVariant> = {
  presentiel: 'info',
  distanciel: 'warning',
  mixte: 'success',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  planifiee: 'Planifiée',
  confirmee: 'Confirmée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

export const SESSION_STATUS_COLORS: Record<SessionStatus, BadgeVariant> = {
  planifiee: 'default',
  confirmee: 'info',
  en_cours: 'success',
  terminee: 'default',
  annulee: 'danger',
}

export const INSCRIPTION_STATUS_LABELS: Record<InscriptionStatus, string> = {
  pre_inscrit: 'Pré-inscrit',
  inscrit: 'Inscrit',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  complete: 'Complété',
  abandonne: 'Abandonné',
  annule: 'Annulé',
}

export const INSCRIPTION_STATUS_COLORS: Record<InscriptionStatus, BadgeVariant> = {
  pre_inscrit: 'default',
  inscrit: 'info',
  confirme: 'info',
  en_cours: 'warning',
  complete: 'success',
  abandonne: 'danger',
  annule: 'danger',
}
