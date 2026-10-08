/**
 * Interrupteurs de fonctionnalités, lisibles côté client comme côté serveur.
 */

/**
 * Certificat de signature électronique des conventions (dossier de preuve PDF).
 * Désactivé le 29/09/2026, remis en service le 08/10/2026 à la demande de
 * Brahim. À false : boutons masqués et route fermée ; les preuves continuent
 * d'être captées à la signature (IP, navigateur, consentement, exemplaire figé,
 * journal). Le certificat n'affiche que l'horodatage réel de la signature,
 * jamais la date portée sur la convention.
 */
export const CERTIFICAT_SIGNATURE_CONVENTION = true

/**
 * Starkk sur le site public : la bulle de discussion qui renseigne les visiteurs.
 * - 'tous'   : affichée à tous les visiteurs ;
 * - 'apercu' : affichée seulement après une visite avec ?starkk=1 (pour l'essayer en ligne avant ouverture) ;
 * - 'coupe'  : bulle masquée et route fermée.
 */
export const STARKK_SITE: 'tous' | 'apercu' | 'coupe' = 'tous'
