// Modèles gratuits du site public : des documents à imprimer et à remplir,
// envoyés au restaurateur en échange de ses coordonnées. Chaque demande crée
// un contact (lead « site web ») dans le CRM.
//
// Aucun import serveur ici : la liste est lue par les pages, le formulaire
// (navigateur), les actions et la route de téléchargement.

export interface Modele {
  slug: string
  /** Titre de la page (h1). */
  titre: string
  /** Titre de l'onglet : 45 caractères au plus, « | Lab Learning » s'y ajoute. */
  titreCourt: string
  /** Description pour les moteurs : 158 caractères au plus. */
  description: string
  accroche: string
  /** Ce que le fichier contient, page par page. */
  contenu: string[]
  /** Comment s'en servir. */
  usage: string[]
  format: string
  /** Nom du fichier remis. */
  fichier: string
  /** Guides du site qui expliquent la règle (lib/guides), le plus proche d'abord. */
  guides: string[]
  /** Date de dernière mise à jour du modèle (AAAA-MM-JJ). */
  majLe: string
  /** Formations liées, retrouvées par leur intitulé (expression régulière sans les barres). */
  formations: string
}

export const MODELES: Modele[] = [
  {
    slug: 'tableau-allergenes-restaurant',
    titre: 'Modèle de tableau des allergènes pour restaurant',
    titreCourt: 'Tableau des allergènes : modèle gratuit',
    description: 'Tableau des 14 allergènes à remplir, mode d’emploi et affichette pour la salle. Modèle gratuit en PDF pour votre restaurant.',
    accroche: 'Un tableau prêt à remplir : vos plats en lignes, les 14 allergènes en colonnes. Imprimez-le, cochez, affichez-le près du comptoir.',
    contenu: [
      'Le tableau à remplir : 18 lignes pour vos plats, sauces et desserts, une case à cocher par allergène, chacun avec son pictogramme.',
      'Le mode d’emploi : ce que dit la règle, comment remplir le tableau, et où se cachent les 14 allergènes.',
      'Une affichette pour la salle : elle indique à vos clients où consulter le tableau.',
    ],
    usage: [
      'Remplissez une ligne par plat tel qu’il est servi, à partir des fiches de vos fournisseurs.',
      'Affichez le tableau ou tenez-le à la disposition des clients, là où ils commandent.',
      'Refaites-le à chaque changement de recette ou de fournisseur.',
    ],
    format: 'PDF, A4 paysage, 3 pages',
    fichier: 'tableau-allergenes-restaurant-lab-learning.pdf',
    guides: ['allergenes-restaurant-affichage-obligatoire', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'allerg[eè]n|hygi[eè]ne|haccp',
  },
  {
    slug: 'releve-temperatures-restaurant',
    titre: 'Fiche de relevé des températures pour restaurant',
    titreCourt: 'Relevé de températures : modèle gratuit',
    description: 'Fiche mensuelle de relevé des températures, repères réglementaires et fiche de contrôle à réception des marchandises. PDF gratuit pour votre restaurant.',
    accroche: 'Une feuille par mois pour quatre enceintes, matin et soir, avec la colonne des actions correctives et le rappel des températures à respecter.',
    contenu: [
      'La feuille du mois : 31 jours, quatre enceintes, relevé à l’ouverture et à la fermeture, visa.',
      'Les repères : les températures de conservation denrée par denrée, la conduite à tenir en cas d’écart, le tableau de vos enceintes.',
      'La fiche de contrôle à réception : température, date limite, emballage, produit accepté ou refusé.',
    ],
    usage: [
      'Inscrivez en haut le nom et la limite de chaque enceinte.',
      'Relevez à heure fixe, à l’ouverture et à la fermeture, et notez la température réellement lue.',
      'Conservez les feuilles : elles font partie des documents demandés lors d’un contrôle.',
    ],
    format: 'PDF, A4 paysage, 3 pages',
    fichier: 'releve-temperatures-restaurant-lab-learning.pdf',
    guides: ['controle-hygiene-restaurant-ddpp', 'formation-hygiene-alimentaire-restauration-rapide'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'plan-nettoyage-desinfection-restaurant',
    titre: 'Modèle de plan de nettoyage et de désinfection pour restaurant',
    titreCourt: 'Plan de nettoyage : modèle gratuit',
    description: 'Plan de nettoyage et de désinfection prérempli pour un restaurant rapide, feuille d’enregistrement de la semaine et méthode en six étapes. PDF gratuit.',
    accroche: 'Seize zones et matériels déjà listés, avec une fréquence conseillée : il vous reste à indiquer vos produits et qui s’en charge.',
    contenu: [
      'Le plan : zone ou matériel, fréquence, produit, dosage et temps de contact, méthode, responsable.',
      'La feuille d’enregistrement de la semaine : une case par zone et par jour, visa du responsable.',
      'La méthode en six étapes, les erreurs qui reviennent et le tableau de vos produits.',
    ],
    usage: [
      'Complétez les produits et les dosages d’après leur fiche technique.',
      'Adaptez les fréquences à votre activité et ajoutez vos propres matériels.',
      'Affichez le plan en cuisine et faites cocher la feuille chaque jour par la personne qui nettoie.',
    ],
    format: 'PDF, A4 paysage, 3 pages',
    fichier: 'plan-nettoyage-restaurant-lab-learning.pdf',
    guides: ['controle-hygiene-restaurant-ddpp', 'formation-hygiene-alimentaire-restauration-rapide'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|nettoyage',
  },
  {
    slug: 'document-unique-duerp-restauration-rapide',
    titre: 'Trame de document unique (DUERP) pour la restauration rapide',
    titreCourt: 'Trame de DUERP restauration rapide',
    description: 'Trame gratuite de document unique d’évaluation des risques pour un restaurant rapide : onze risques déjà décrits, méthode de cotation, plan d’actions.',
    accroche: 'Les onze risques que l’on retrouve dans presque toutes les cuisines de restauration rapide, avec des exemples de mesures. Vous cotez, vous complétez, vous signez.',
    contenu: [
      'Le tableau d’évaluation : unité de travail, danger, gravité, fréquence, mesures existantes, actions à prévoir. Onze risques y sont déjà décrits.',
      'La méthode : les échelles de cotation, la grille des priorités, les rappels du code du travail.',
      'Le plan d’actions de prévention, à dater et à signer.',
    ],
    usage: [
      'Gardez les lignes qui vous concernent, supprimez les autres, ajoutez vos propres situations.',
      'Cotez chaque risque avec votre équipe et décidez d’une action pour les plus élevés.',
      'Datez, signez et reprenez-le à chaque changement, et au moins une fois par an à partir de 11 salariés.',
    ],
    format: 'PDF, A4 paysage, 3 pages',
    fichier: 'trame-duerp-restauration-rapide-lab-learning.pdf',
    guides: ['document-unique-duerp-restaurant', 'ouvrir-restaurant-rapide-formations-obligations'],
    majLe: '2026-10-06',
    formations: 'duerp|document unique|risques? professionnel|pr[eé]vention des risques',
  },
]

export const modeleParSlug = (slug: string) => MODELES.find((m) => m.slug === slug) || null
/** Les modèles qui accompagnent un guide. */
export const modelesDuGuide = (guide: string) => MODELES.filter((m) => m.guides.includes(guide))
/** Image d'aperçu d'une des trois pages du modèle. */
export const apercuModele = (slug: string, page: 1 | 2 | 3 = 1) => `/site/photos/modeles/${slug}${page > 1 ? `-${page}` : ''}.webp`
/** Intitulé sans la mention « modèle gratuit », pour les phrases et les mails. */
export const nomModele = (m: Modele) => m.titreCourt.replace(/ : modèle gratuit$/, '')

export const EFFECTIFS = ['Moins de 11 salariés', 'De 11 à 49 salariés', '50 salariés et plus']

/** L'organisme du site public. */
export const ORG_SITE_MODELES = 'ff747dfe-c034-44d8-98d7-e53892263fb5'
/** Clé de l'horodatage signé émis par les pages des modèles (voir lib/inscription-formateur-garde). */
export const CLE_GARDE_MODELES = `modele.${ORG_SITE_MODELES}`

export interface DemandeModele {
  prenom: string
  nom: string
  email: string
  etablissement: string
  telephone: string
  effectif: string
}

export type ResultatModele = {
  success: boolean
  error?: string
  data?: { url: string; fichier: string; envoye: boolean }
}
