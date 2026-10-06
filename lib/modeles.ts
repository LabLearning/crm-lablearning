// Modèles gratuits du site public : des documents à imprimer et à remplir,
// envoyés au restaurateur en échange de ses coordonnées. Chaque demande crée
// un contact (lead « site web ») dans le CRM.
//
// Aucun import serveur ici : la liste est lue par les pages, le formulaire
// (navigateur), les actions et la route de téléchargement.

/** Rubriques de la page des modèles. */
export const THEMES_MODELES = ['Hygiène alimentaire', 'Équipe et sécurité'] as const
export type ThemeModele = (typeof THEMES_MODELES)[number]

export interface Modele {
  slug: string
  /** Nom court, pour les cartes, les phrases et les mails. */
  nom: string
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
  theme: ThemeModele
  /** Mis en avant en tête de la page des modèles. */
  vedette?: boolean
  /** Nombre de pages du PDF. */
  pages: number
  /** Pages du PDF montrées en aperçu sur le site, la première d'abord (trois au plus). */
  apercus: number[]
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
    slug: 'plan-de-maitrise-sanitaire-pms-restauration-rapide',
    nom: 'Plan de maîtrise sanitaire (PMS)',
    titre: 'Modèle de plan de maîtrise sanitaire (PMS) pour la restauration rapide',
    titreCourt: 'Modèle de PMS restaurant gratuit',
    description: 'Trame gratuite de plan de maîtrise sanitaire pour la restauration rapide : 32 pages à compléter, avec toutes les fiches de relevé. PDF à imprimer.',
    accroche: 'Le classeur d’hygiène complet de votre établissement : vos règles, la méthode HACCP expliquée simplement, et toutes les feuilles de relevé, prêtes à imprimer.',
    contenu: [
      'Les pages de présentation : engagement du responsable, informations sur l’établissement, plan de la cuisine, sommaire.',
      'Vos règles, partie par partie : équipe, locaux, nettoyage, nuisibles, températures, huiles de friture, traçabilité, allergènes, alertes.',
      'Toutes les feuilles de relevé et d’enregistrement, à imprimer autant de fois que nécessaire.',
      'La méthode HACCP en sept principes, et une analyse des dangers préremplie pour un restaurant rapide.',
      'La revue annuelle, pour tenir le classeur à jour.',
    ],
    usage: [
      'Complétez les pages de présentation et les plans avec ce qui se fait réellement chez vous.',
      'Imprimez les feuilles de relevé et faites-les remplir chaque jour.',
      'Relisez le classeur une fois par an, et à chaque changement de carte, de matériel ou d’équipe.',
    ],
    theme: 'Hygiène alimentaire',
    vedette: true,
    pages: 32,
    apercus: [1, 3, 31],
    fichier: 'plan-maitrise-sanitaire-pms-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'tableau-allergenes-restaurant',
    nom: 'Tableau des allergènes',
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
    theme: 'Hygiène alimentaire',
    pages: 3,
    apercus: [1, 2, 3],
    fichier: 'tableau-allergenes-restaurant-lab-learning.pdf',
    guides: ['allergenes-restaurant-affichage-obligatoire', 'plan-de-maitrise-sanitaire-pms-restaurant'],
    majLe: '2026-10-06',
    formations: 'allerg[eè]n|hygi[eè]ne|haccp',
  },
  {
    slug: 'releve-temperatures-restaurant',
    nom: 'Relevé de températures',
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
    theme: 'Hygiène alimentaire',
    pages: 3,
    apercus: [1, 2, 3],
    fichier: 'releve-temperatures-restaurant-lab-learning.pdf',
    guides: ['controle-hygiene-restaurant-ddpp', 'plan-de-maitrise-sanitaire-pms-restaurant'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'plan-nettoyage-desinfection-restaurant',
    nom: 'Plan de nettoyage',
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
    theme: 'Hygiène alimentaire',
    pages: 3,
    apercus: [1, 2, 3],
    fichier: 'plan-nettoyage-restaurant-lab-learning.pdf',
    guides: ['controle-hygiene-restaurant-ddpp', 'plan-de-maitrise-sanitaire-pms-restaurant'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|nettoyage',
  },
  {
    slug: 'document-unique-duerp-restauration-rapide',
    nom: 'Trame de DUERP',
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
    theme: 'Équipe et sécurité',
    pages: 3,
    apercus: [1, 2, 3],
    fichier: 'trame-duerp-restauration-rapide-lab-learning.pdf',
    guides: ['document-unique-duerp-restaurant', 'ouvrir-restaurant-rapide-formations-obligations'],
    majLe: '2026-10-06',
    formations: 'duerp|document unique|risques? professionnel|pr[eé]vention des risques',
  },
  {
    slug: 'suivi-huiles-friture-restaurant',
    nom: 'Suivi des huiles de friture',
    titre: 'Fiche de suivi des huiles de friture',
    titreCourt: 'Suivi des huiles de friture : modèle gratuit',
    description: 'Fiche mensuelle de suivi des huiles de friture et repères : seuil de 25 % de composés polaires, température, gestes qui font durer l’huile. PDF gratuit.',
    accroche: 'Une feuille par mois pour noter chaque contrôle et chaque changement de bain, avec les repères qui disent quand l’huile doit être changée.',
    contenu: [
      'La feuille du mois : aspect de l’huile, taux de composés polaires, décision, visa.',
      'Les repères : le seuil réglementaire, la température à ne pas dépasser, les gestes qui font durer une huile, ce que devient l’huile usagée.',
    ],
    usage: [
      'Testez l’huile à fréquence fixe et notez la valeur, même quand elle est bonne.',
      'Changez le bain dès qu’il dépasse le seuil, et notez-le.',
      'Gardez les bons d’enlèvement de votre collecteur avec ces feuilles.',
    ],
    theme: 'Hygiène alimentaire',
    pages: 2,
    apercus: [1, 2],
    fichier: 'suivi-huiles-friture-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'fiche-tracabilite-etiquettes-restaurant',
    nom: 'Traçabilité et étiquettes',
    titre: 'Fiche de traçabilité et étiquettes de dates pour restaurant',
    titreCourt: 'Fiche de traçabilité : modèle gratuit',
    description: 'Fiche de traçabilité mensuelle, repères sur les DLC et les DDM, et planche d’étiquettes à découper pour les produits entamés. PDF gratuit.',
    accroche: 'De quoi retrouver le fournisseur, le lot et la date de chaque produit, et étiqueter tout ce qui est entamé.',
    contenu: [
      'La fiche du mois : produit, fournisseur, numéro de lot, dates, visa.',
      'Les repères : ce qu’il faut garder, comment étiqueter ce qui est entamé, la différence entre DLC et DDM.',
      'Une planche de quinze étiquettes à imprimer et à découper.',
    ],
    usage: [
      'Notez les produits sensibles à la réception, ou classez leurs étiquettes par jour.',
      'Collez une étiquette datée sur chaque bac, chaque sauce, chaque produit sorti de son emballage.',
      'Fixez une durée de vie pour vos préparations maison, et tenez-vous-y.',
    ],
    theme: 'Hygiène alimentaire',
    pages: 3,
    apercus: [1, 2, 3],
    fichier: 'fiche-tracabilite-etiquettes-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'refroidissement-remise-en-temperature',
    nom: 'Refroidissement et remise en température',
    titre: 'Fiche de suivi du refroidissement et de la remise en température',
    titreCourt: 'Refroidissement rapide : fiche gratuite',
    description: 'Fiche de suivi du refroidissement rapide et de la remise en température, avec les durées de référence. Modèle gratuit en PDF pour votre restaurant.',
    accroche: 'Pour chaque préparation refroidie ou réchauffée : l’heure et la température au début et à la fin, et la durée à ne pas dépasser.',
    contenu: [
      'La fiche de suivi : un tableau pour le refroidissement, un pour la remise en température.',
      'Les repères : les durées de référence, comment refroidir et réchauffer vite, quoi faire hors délai.',
    ],
    usage: [
      'Notez l’heure et la température au début, puis à la fin.',
      'Comparez la durée au repère : deux heures pour refroidir, une heure pour réchauffer.',
      'Hors délai, la préparation est jetée et la cause notée.',
    ],
    theme: 'Hygiène alimentaire',
    pages: 2,
    apercus: [1, 2],
    fichier: 'refroidissement-remise-en-temperature-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'plan-lutte-nuisibles-restaurant',
    nom: 'Plan de lutte contre les nuisibles',
    titre: 'Modèle de plan de lutte contre les nuisibles pour restaurant',
    titreCourt: 'Plan de lutte nuisibles : modèle gratuit',
    description: 'Plan de lutte contre les nuisibles prérempli pour un restaurant, et feuille de suivi des passages : rongeurs, insectes, oiseaux. PDF gratuit.',
    accroche: 'Les mesures préventives sont déjà écrites pour les rongeurs, les insectes et les oiseaux : il vous reste à indiquer vos pièges et qui surveille.',
    contenu: [
      'Le plan : mesures préventives, emplacement des pièges, surveillance, conduite à tenir en cas de présence.',
      'La feuille de suivi de l’année : chaque passage du prestataire, chaque constat, chaque action.',
    ],
    usage: [
      'Adaptez les mesures préventives à votre local et notez l’emplacement des pièges.',
      'Joignez le plan du local, le contrat du prestataire et ses rapports de passage.',
      'Notez chaque contrôle, même quand il n’y a rien à signaler.',
    ],
    theme: 'Hygiène alimentaire',
    pages: 2,
    apercus: [1, 2],
    fichier: 'plan-lutte-nuisibles-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'fiche-non-conformite-alerte-sanitaire',
    nom: 'Non-conformités et alertes',
    titre: 'Fiche de non-conformité et conduite à tenir en cas d’alerte sanitaire',
    titreCourt: 'Fiche de non-conformité : modèle gratuit',
    description: 'Rappel de produit, anomalie, clients malades : la conduite à tenir en trois marches à suivre, et la fiche de non-conformité à remplir. PDF gratuit.',
    accroche: 'Ce que l’équipe doit faire quand un fournisseur rappelle un produit, quand une anomalie est constatée ou quand des clients se disent malades.',
    contenu: [
      'Les trois marches à suivre, les questions qu’on vous posera et vos numéros utiles.',
      'La fiche de non-conformité : ce qui a été constaté, l’action immédiate, ce qui change ensuite.',
    ],
    usage: [
      'Remplissez vos numéros utiles aujourd’hui, et affichez la page au bureau.',
      'À chaque anomalie, notez ce qui a été constaté et ce qui a été fait.',
      'Relisez les fiches de l’année lors de votre revue annuelle.',
    ],
    theme: 'Hygiène alimentaire',
    pages: 2,
    apercus: [1, 2],
    fichier: 'fiche-non-conformite-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'controle-hygiene-restaurant-ddpp'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'affiche-lavage-des-mains',
    nom: 'Affichette lavage des mains',
    titre: 'Affiche lavage des mains pour cuisine professionnelle',
    titreCourt: 'Affiche lavage des mains gratuite',
    description: 'Affiche « Je me lave les mains » pour votre cuisine : les six gestes, 30 secondes, et les moments où le lavage est indispensable. PDF gratuit.',
    accroche: 'Les six gestes du lavage des mains et les cinq moments où il est indispensable, à afficher au-dessus de chaque lave-mains.',
    contenu: [
      'Une affichette A4 paysage : les six gestes, en pictogrammes, et les moments où se laver les mains.',
    ],
    usage: [
      'Imprimez-la en couleur, plastifiez-la si possible.',
      'Affichez-la au-dessus de chaque lave-mains, à hauteur des yeux.',
      'Montrez-la à chaque nouvel équipier le premier jour.',
    ],
    theme: 'Hygiène alimentaire',
    pages: 1,
    apercus: [1],
    fichier: 'affiche-lavage-des-mains-lab-learning.pdf',
    guides: ['plan-de-maitrise-sanitaire-pms-restaurant', 'formation-hygiene-alimentaire-restauration-rapide'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|ma[iî]trise sanitaire',
  },
  {
    slug: 'suivi-formations-equipe-restaurant',
    nom: 'Suivi des formations de l’équipe',
    titre: 'Tableau de suivi des formations de l’équipe',
    titreCourt: 'Suivi des formations : modèle gratuit',
    description: 'Tableau de suivi des formations de votre équipe : hygiène alimentaire, consignes au poste, sécurité. Avec le rappel des obligations. PDF gratuit.',
    accroche: 'Une ligne par équipier pour savoir qui a été formé à quoi, et quand : c’est la première chose que l’on vous demande lors d’un contrôle.',
    contenu: [
      'Le tableau de suivi : hygiène alimentaire, consignes au poste, sécurité, autres formations, attestation classée.',
      'Les règles : la personne formée à l’hygiène, les consignes pour toute l’équipe, la sécurité au poste, et les formations à prévoir.',
    ],
    usage: [
      'Ajoutez une ligne à chaque arrivée, et notez la date des consignes transmises.',
      'Classez la copie des attestations derrière la feuille.',
      'Prévoyez une seconde personne formée à l’hygiène : si la première part, vous restez en règle.',
    ],
    theme: 'Équipe et sécurité',
    pages: 2,
    apercus: [1, 2],
    fichier: 'suivi-formations-equipe-lab-learning.pdf',
    guides: ['formation-hygiene-alimentaire-restauration-rapide', 'ouvrir-restaurant-rapide-formations-obligations'],
    majLe: '2026-10-06',
    formations: 'hygi[eè]ne|haccp|s[eé]curit[eé]|pr[eé]vention des risques',
  },
]

export const modeleParSlug = (slug: string) => MODELES.find((m) => m.slug === slug) || null
/** Les modèles qui accompagnent un guide. */
export const modelesDuGuide = (guide: string) => MODELES.filter((m) => m.guides.includes(guide))
/** Image d'aperçu d'un modèle : la première page par défaut, sinon la 2e ou la 3e des pages montrées. */
export const apercuModele = (slug: string, rang: number = 1) => `/site/photos/modeles/${slug}${rang > 1 ? `-${rang}` : ''}.webp`
/** Nom court du modèle, pour les phrases et les mails. */
export const nomModele = (m: Modele) => m.nom
/** « PDF, A4 paysage, 3 pages ». */
export const formatModele = (m: Modele) => `PDF, A4 paysage, ${m.pages} page${m.pages > 1 ? 's' : ''}`

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
