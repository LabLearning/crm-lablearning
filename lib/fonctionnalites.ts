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
