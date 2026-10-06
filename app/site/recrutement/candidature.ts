// Listes du formulaire de candidature des formateurs, partagées par la page
// (serveur), le formulaire (navigateur) et les actions. Aucun import serveur ici.

/** L'organisme du site public. */
export const ORG_SITE = 'ff747dfe-c034-44d8-98d7-e53892263fb5'

/** Adresse du recrutement : affichée sur la page, et adresse de réponse du mail de confirmation envoyé au candidat. */
export const EMAIL_RECRUTEMENT = 'recrutement@lab-learning.fr'

/** Clé de l'horodatage signé émis par la page de recrutement (voir lib/inscription-formateur-garde). */
export const CLE_GARDE_CANDIDATURE = `candidature.${ORG_SITE}`

/**
 * Les postes ouverts, dans l'ordre des fiches de poste de la page. `domaines`
 * coche d'avance les domaines du CRM (lib/inscription-formateur) qui vont avec.
 */
export const POSTES_CANDIDATURE: { cle: string; libelle: string; domaines: string[] }[] = [
  { cle: 'hygiene', libelle: 'Formateur hygiène alimentaire et HACCP', domaines: ['Hygiène alimentaire et HACCP'] },
  { cle: 'securite', libelle: 'Formateur prévention et sécurité au travail', domaines: ['Prévention des risques et sécurité au travail'] },
  { cle: 'metiers', libelle: 'Formateur métiers de bouche', domaines: ['Cuisine'] },
  { cle: 'management', libelle: 'Formateur management et gestion', domaines: ['Management et encadrement', 'Gestion et rentabilité en restauration'] },
  { cle: 'prise-de-poste', libelle: 'Formateur accompagnateur à la prise de poste', domaines: ['Accompagnement POEI et insertion'] },
]

/**
 * Domaines proposés au candidat. La valeur est celle du CRM ; le libellé est
 * celui du site, qui ne nomme pas les dispositifs de France Travail.
 */
export const DOMAINES_CANDIDATURE: { valeur: string; libelle: string }[] = [
  { valeur: 'Hygiène alimentaire et HACCP', libelle: 'Hygiène alimentaire, HACCP' },
  { valeur: 'Prévention des risques et sécurité au travail', libelle: 'Prévention et sécurité au travail' },
  { valeur: 'Secourisme (SST)', libelle: 'Secourisme (SST)' },
  { valeur: 'Management et encadrement', libelle: 'Management' },
  { valeur: 'Gestion et rentabilité en restauration', libelle: 'Gestion et rentabilité' },
  { valeur: 'Relation client et vente', libelle: 'Relation client et vente' },
  { valeur: 'Restauration rapide', libelle: 'Restauration rapide' },
  { valeur: 'Cuisine', libelle: 'Cuisine' },
  { valeur: 'Boucherie', libelle: 'Boucherie' },
  { valeur: 'Boulangerie', libelle: 'Boulangerie' },
  { valeur: 'Pâtisserie', libelle: 'Pâtisserie' },
  { valeur: 'Service en salle et bar', libelle: 'Service en salle et bar' },
  { valeur: 'Accompagnement POEI et insertion', libelle: 'Accompagnement à la prise de poste' },
]

export const EXPERIENCES = ['Moins de 2 ans', '2 à 5 ans', '5 à 10 ans', 'Plus de 10 ans']
export const ZONES = ['Ma ville et ses environs', 'Mon département', 'Ma région', 'Toute la France']
export const DISPONIBILITES = ['Dès maintenant', 'Sous un mois', 'Dans les trois mois', 'Ponctuellement, en complément d’une autre activité']
