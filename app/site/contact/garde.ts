/** Organisme du site public (Lab Learning), qui reçoit les messages de la page Contact */
export const ORG_SITE_CONTACT = process.env.PUBLIC_SITE_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'

/** Clé de l'horodatage signé de la page Contact (lib/inscription-formateur-garde) */
export const CLE_GARDE_CONTACT = `contact.${ORG_SITE_CONTACT}`
