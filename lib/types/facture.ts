// ============================================================
// Types Module 6 — Facturation & Paiements
// ============================================================

import type { BadgeVariant } from '@/lib/types'

export type FactureType = 'facture' | 'acompte' | 'solde' | 'avoir'
export type FactureStatus = 'brouillon' | 'emise' | 'envoyee' | 'payee_partiellement' | 'payee' | 'en_retard' | 'annulee'
export type PaiementMode = 'virement' | 'cb' | 'cheque' | 'prelevement' | 'especes' | 'stripe' | 'opco' | 'cpf' | 'autre'
export type PaiementStatus = 'en_attente' | 'valide' | 'refuse' | 'rembourse'

export interface Facture {
  id: string
  organization_id: string
  numero: string
  type: FactureType
  client_id: string
  contact_id: string | null
  devis_id: string | null
  convention_id: string | null
  dossier_id: string | null
  session_id: string | null
  facture_origine_id: string | null
  status: FactureStatus
  date_emission: string
  date_echeance: string
  date_envoi: string | null
  date_paiement_complet: string | null
  montant_ht: number
  taux_tva: number
  montant_tva: number
  montant_ttc: number
  montant_paye: number
  montant_restant: number
  remise_pourcent: number
  remise_montant: number
  objet: string | null
  conditions_paiement: string | null
  notes_internes: string | null
  financeur_type: string | null
  financeur_nom: string | null
  subrogation: boolean
  relance_count: number
  affacturage_status: 'cedee' | 'avancee' | 'soldee' | 'impayee' | null
  created_at: string
  updated_at: string
  // Joined
  client?: { raison_sociale: string | null; nom: string | null; prenom: string | null; type: string; email: string | null }
  formation?: { intitule: string }
  lignes?: FactureLigne[]
  paiements?: Paiement[]
}

export interface FactureLigne {
  id: string
  facture_id: string
  designation: string
  description: string | null
  quantite: number
  unite: string
  prix_unitaire_ht: number
  montant_ht: number
  position: number
}

export interface Paiement {
  id: string
  organization_id: string
  facture_id: string
  montant: number
  mode: PaiementMode
  status: PaiementStatus
  date_paiement: string
  date_validation: string | null
  reference: string | null
  stripe_payment_id: string | null
  payeur_nom: string | null
  payeur_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  facture?: { numero: string; montant_ttc: number; client?: { raison_sociale: string | null } }
}

// ---- Labels ----

export const FACTURE_TYPE_LABELS: Record<FactureType, string> = {
  facture: 'Facture',
  acompte: 'Acompte',
  solde: 'Solde',
  avoir: 'Avoir',
}

export const FACTURE_STATUS_LABELS: Record<FactureStatus, string> = {
  brouillon: 'Brouillon',
  emise: 'Émise',
  envoyee: 'Envoyée',
  payee_partiellement: 'Payée part.',
  payee: 'Payée',
  en_retard: 'En retard',
  annulee: 'Annulée',
}

export const FACTURE_STATUS_COLORS: Record<FactureStatus, BadgeVariant> = {
  brouillon: 'default',
  emise: 'info',
  envoyee: 'info',
  payee_partiellement: 'warning',
  payee: 'success',
  en_retard: 'danger',
  annulee: 'default',
}

export const PAIEMENT_MODE_LABELS: Record<PaiementMode, string> = {
  virement: 'Virement',
  cb: 'Carte bancaire',
  cheque: 'Chèque',
  prelevement: 'Prélèvement',
  especes: 'Espèces',
  stripe: 'Stripe',
  opco: 'OPCO',
  cpf: 'CPF',
  autre: 'Autre',
}

export const PAIEMENT_STATUS_LABELS: Record<PaiementStatus, string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  refuse: 'Refusé',
  rembourse: 'Remboursé',
}

export const PAIEMENT_STATUS_COLORS: Record<PaiementStatus, BadgeVariant> = {
  en_attente: 'warning',
  valide: 'success',
  refuse: 'danger',
  rembourse: 'default',
}
