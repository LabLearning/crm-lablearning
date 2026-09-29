/**
 * Texte de la case que le client coche avant de signer sa convention. Il est
 * affiché sur la page de signature et recopié tel quel dans les preuves :
 * les deux lisent ce module, qui n'importe rien côté serveur.
 */
export const TEXTE_CONSENTEMENT_CONVENTION =
  'J’ai pris connaissance de la convention et j’en accepte les termes au nom de l’entreprise que je représente.'
export const TEXTE_CONSENTEMENT_CONTRAT =
  'J’ai pris connaissance du contrat de formation et j’en accepte les termes.'

export const texteConsentement = (particulier: boolean) =>
  particulier ? TEXTE_CONSENTEMENT_CONTRAT : TEXTE_CONSENTEMENT_CONVENTION
