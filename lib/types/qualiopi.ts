// ============================================================
// Types Module 8 — Qualiopi & Réclamations
// ============================================================

import type { BadgeVariant } from '@/lib/types'

export type ConformiteNiveau = 'conforme' | 'partiellement_conforme' | 'non_conforme' | 'non_applicable' | 'non_evalue'
export type ReclamationStatus = 'recue' | 'en_analyse' | 'action_corrective' | 'cloturee'
export type ReclamationOrigine = 'apprenant' | 'entreprise' | 'financeur' | 'formateur' | 'interne' | 'autre'
export type ActionStatus = 'planifiee' | 'en_cours' | 'realisee' | 'verifiee' | 'abandonnee'
export type ActionPriorite = 'basse' | 'moyenne' | 'haute' | 'critique'

export interface QualiopiIndicateur {
  id: string
  organization_id: string
  critere: number
  indicateur: number
  libelle: string
  description: string | null
  niveau: ConformiteNiveau
  commentaire: string | null
  date_evaluation: string | null
  evalue_par: string | null
  preuves_attendues: string | null
  created_at: string
  updated_at: string
  preuves?: QualiopiPreuve[]
}

export interface QualiopiPreuve {
  id: string
  organization_id: string
  indicateur_id: string
  titre: string
  description: string | null
  type: string
  document_url: string | null
  lien_externe: string | null
  entity_type: string | null
  entity_id: string | null
  date_preuve: string
  est_valide: boolean
  created_at: string
  signed_url?: string | null
}

export interface Reclamation {
  id: string
  organization_id: string
  numero: string
  objet: string
  description: string
  origine: ReclamationOrigine
  emetteur_nom: string | null
  emetteur_email: string | null
  status: ReclamationStatus
  priorite: ActionPriorite
  analyse: string | null
  action_corrective: string | null
  date_reception: string
  date_analyse: string | null
  date_resolution: string | null
  date_cloture: string | null
  responsable_id: string | null
  resolution_satisfaisante: boolean | null
  commentaire_cloture: string | null
  created_at: string
  updated_at: string
  responsable?: { first_name: string; last_name: string }
  actions?: ActionAmelioration[]
}

export interface ActionAmelioration {
  id: string
  organization_id: string
  titre: string
  description: string | null
  source: string
  reclamation_id: string | null
  indicateur_id: string | null
  status: ActionStatus
  priorite: ActionPriorite
  responsable_id: string | null
  date_planifiee: string | null
  date_echeance: string | null
  date_realisation: string | null
  resultat: string | null
  efficacite: string | null
  created_at: string
  responsable?: { first_name: string; last_name: string }
}

// ---- Labels ----

export const CONFORMITE_LABELS: Record<ConformiteNiveau, string> = {
  conforme: 'Conforme',
  partiellement_conforme: 'Partiellement conforme',
  non_conforme: 'Non conforme',
  non_applicable: 'Non applicable',
  non_evalue: 'Non évalué',
}

export const CONFORMITE_COLORS: Record<ConformiteNiveau, BadgeVariant> = {
  conforme: 'success',
  partiellement_conforme: 'warning',
  non_conforme: 'danger',
  non_applicable: 'default',
  non_evalue: 'default',
}

export const CRITERE_LABELS: Record<number, string> = {
  1: 'Information du public',
  2: 'Objectifs et adaptation',
  3: 'Accompagnement',
  4: 'Moyens pédagogiques',
  5: 'Qualification des intervenants',
  6: 'Environnement professionnel',
  7: 'Amélioration continue',
}

export const RECLAMATION_STATUS_LABELS: Record<ReclamationStatus, string> = {
  recue: 'Reçue',
  en_analyse: 'En analyse',
  action_corrective: 'Action corrective',
  cloturee: 'Clôturée',
}

export const RECLAMATION_STATUS_COLORS: Record<ReclamationStatus, BadgeVariant> = {
  recue: 'danger',
  en_analyse: 'warning',
  action_corrective: 'info',
  cloturee: 'success',
}

export const ORIGINE_LABELS: Record<ReclamationOrigine, string> = {
  apprenant: 'Apprenant',
  entreprise: 'Entreprise',
  financeur: 'Financeur',
  formateur: 'Formateur',
  interne: 'Interne',
  autre: 'Autre',
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  realisee: 'Réalisée',
  verifiee: 'Vérifiée',
  abandonnee: 'Abandonnée',
}

export const ACTION_STATUS_COLORS: Record<ActionStatus, BadgeVariant> = {
  planifiee: 'default',
  en_cours: 'warning',
  realisee: 'success',
  verifiee: 'success',
  abandonnee: 'danger',
}

export const PRIORITE_LABELS: Record<ActionPriorite, string> = {
  basse: 'Basse',
  moyenne: 'Moyenne',
  haute: 'Haute',
  critique: 'Critique',
}

export const PRIORITE_COLORS: Record<ActionPriorite, BadgeVariant> = {
  basse: 'default',
  moyenne: 'info',
  haute: 'warning',
  critique: 'danger',
}
