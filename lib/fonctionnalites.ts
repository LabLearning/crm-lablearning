/**
 * Interrupteurs de fonctionnalités, lisibles côté client comme côté serveur.
 */

/**
 * Certificat de signature électronique des conventions (dossier de preuve PDF).
 * Désactivé le 29/09/2026 à la demande de Brahim : boutons masqués et route
 * fermée. Les preuves continuent d'être captées à la signature (IP, navigateur,
 * consentement, exemplaire figé, journal), le certificat peut donc être rouvert
 * à tout moment en repassant cette valeur à true.
 */
export const CERTIFICAT_SIGNATURE_CONVENTION = false

/**
 * Starkk sur le site public : la bulle de discussion qui renseigne les visiteurs.
 * - 'tous'   : affichée à tous les visiteurs ;
 * - 'apercu' : affichée seulement après une visite avec ?starkk=1 (pour l'essayer en ligne avant ouverture) ;
 * - 'coupe'  : bulle masquée et route fermée.
 */
export const STARKK_SITE: 'tous' | 'apercu' | 'coupe' = 'tous'
