/**
 * État du compte OPCO d'un client : libellés, couleurs et phrase de badge.
 * Module sans dépendance serveur, importable par les composants client
 * (lib/opco.ts, lui, ouvre une connexion Supabase).
 */

export const OPCO_COMPTE_STATUS_LABELS = {
  aucun: 'Aucun compte',
  courrier_envoye: 'Courrier envoyé',
  en_attente_validation: 'En attente de validation',
  actif: 'Actif',
  inactif: 'Inactif',
} as const

export type OpcoCompteStatus = keyof typeof OPCO_COMPTE_STATUS_LABELS

/** Couleurs du badge d'état du compte OPCO : rouge tant qu'il n'existe pas, vert quand il est actif. */
export const OPCO_COMPTE_STATUS_STYLES: Record<OpcoCompteStatus, string> = {
  aucun: 'bg-danger-50 text-danger-700 border-danger-100',
  courrier_envoye: 'bg-warning-50 text-warning-700 border-warning-100',
  en_attente_validation: 'bg-info-50 text-info-600 border-info-100',
  actif: 'bg-success-50 text-success-600 border-success-100',
  inactif: 'bg-surface-100 text-surface-600 border-surface-200',
}

/** Libellé court pour un badge : « Compte AKTO actif », « Compte AKTO à créer »… */
export function libelleCompteOpco(status: OpcoCompteStatus | null | undefined, opcoNom?: string | null): string {
  const qui = opcoNom ? `Compte ${opcoNom}` : 'Compte OPCO'
  switch (status) {
    case 'actif': return `${qui} actif`
    case 'courrier_envoye': return `${qui} : courrier envoyé`
    case 'en_attente_validation': return `${qui} : en attente de validation`
    case 'inactif': return `${qui} inactif`
    default: return `${qui} à créer`
  }
}
