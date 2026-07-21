// ============================================================
// Types Module 11 — Documents & Signatures
// ============================================================

import type { BadgeVariant } from '@/lib/types'

export type DocumentType = 'devis' | 'convention' | 'contrat' | 'convocation' | 'programme' | 'reglement_interieur' | 'emargement' | 'attestation_fin' | 'attestation_assiduite' | 'certificat_realisation' | 'facture' | 'avoir' | 'kbis' | 'courrier_opco' | 'attestation_urssaf' | 'rib' | 'piece_identite' | 'assurance' | 'statuts' | 'support_pedagogique' | 'diaporama' | 'exercice' | 'ressource' | 'autre'
export type SignatureStatus = 'en_attente' | 'signe' | 'refuse' | 'expire'

/** Qui peut consulter un document rattaché à une session */
export type DocumentVisibilite = 'formateur' | 'stagiaires' | 'tous'

export interface Document {
  id: string
  organization_id: string
  nom: string
  type: DocumentType
  description: string | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  storage_path: string | null
  visibilite: DocumentVisibilite
  requires_signature: boolean
  client_id: string | null
  session_id: string | null
  dossier_id: string | null
  formateur_id: string | null
  apprenant_id: string | null
  version: number
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  client?: { raison_sociale: string | null }
  signatures?: Signature[]
  _signatures_pending?: number
}

export interface Signature {
  id: string
  document_id: string
  signataire_nom: string
  signataire_email: string
  signataire_role: string | null
  token: string
  status: SignatureStatus
  signed_at: string | null
  relance_count: number
  expire_at: string | null
  created_at: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  devis: 'Devis', convention: 'Convention', contrat: 'Contrat', convocation: 'Convocation',
  programme: 'Programme', reglement_interieur: 'Règlement intérieur', emargement: 'Émargement',
  attestation_fin: 'Attestation de fin', attestation_assiduite: 'Attestation d\'assiduité',
  certificat_realisation: 'Certificat de réalisation', facture: 'Facture', avoir: 'Avoir',
  kbis: 'Kbis', courrier_opco: 'Courrier OPCO / AKTO', attestation_urssaf: 'Attestation URSSAF',
  rib: 'RIB', piece_identite: 'Pièce d\'identité', assurance: 'Attestation d\'assurance',
  statuts: 'Statuts', support_pedagogique: 'Support de cours', diaporama: 'Diaporama',
  exercice: 'Exercice', ressource: 'Ressource complémentaire', autre: 'Autre',
}

/** Types réservés aux supports pédagogiques téléversés sur une session */
export const DOCUMENT_TYPES_SUPPORT: DocumentType[] = [
  'support_pedagogique', 'diaporama', 'exercice', 'ressource',
]

export const DOCUMENT_VISIBILITE_LABELS: Record<DocumentVisibilite, string> = {
  formateur: 'Formateur uniquement',
  stagiaires: 'Formateur + stagiaires',
  tous: 'Tout le monde (client inclus)',
}

export const DOCUMENT_VISIBILITE_SHORT: Record<DocumentVisibilite, string> = {
  formateur: 'Formateur', stagiaires: 'Stagiaires', tous: 'Tous',
}

/** Types pertinents pour les pièces administratives d'une société (fiche client) */
export const DOCUMENT_TYPES_ENTREPRISE: DocumentType[] = [
  'kbis', 'courrier_opco', 'attestation_urssaf', 'rib', 'assurance', 'statuts', 'contrat', 'autre',
]

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  en_attente: 'En attente', signe: 'Signé', refuse: 'Refusé', expire: 'Expiré',
}

export const SIGNATURE_STATUS_COLORS: Record<SignatureStatus, BadgeVariant> = {
  en_attente: 'warning', signe: 'success', refuse: 'danger', expire: 'default',
}
