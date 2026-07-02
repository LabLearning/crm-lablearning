// ============================================================
// Types Module 11 — Documents & Signatures
// ============================================================

import type { BadgeVariant } from '@/lib/types'

export type DocumentType = 'devis' | 'convention' | 'contrat' | 'convocation' | 'programme' | 'reglement_interieur' | 'emargement' | 'attestation_fin' | 'attestation_assiduite' | 'certificat_realisation' | 'facture' | 'avoir' | 'autre'
export type SignatureStatus = 'en_attente' | 'signe' | 'refuse' | 'expire'

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
  certificat_realisation: 'Certificat de réalisation', facture: 'Facture', avoir: 'Avoir', autre: 'Autre',
}

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  en_attente: 'En attente', signe: 'Signé', refuse: 'Refusé', expire: 'Expiré',
}

export const SIGNATURE_STATUS_COLORS: Record<SignatureStatus, BadgeVariant> = {
  en_attente: 'warning', signe: 'success', refuse: 'danger', expire: 'default',
}
