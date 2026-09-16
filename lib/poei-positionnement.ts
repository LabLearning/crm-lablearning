/**
 * Positionnement à l'entrée d'un parcours POEI « Équipier polyvalent en
 * restauration rapide ».
 *
 * France Travail finance un volume d'heures : il faut pouvoir montrer, candidat
 * par candidat, l'écart entre son niveau d'entrée et le référentiel de
 * compétences du poste. Le questionnaire situe le candidat sur les cinq
 * domaines du métier ; les heures préconisées se déduisent de l'écart mesuré.
 *
 * Les heures de référence des cinq domaines totalisent exactement les 140 h du
 * parcours : c'est ce qui rend la justification lisible pour le financeur.
 */

export const DUREE_PARCOURS_REFERENCE = 140

/** Le module hygiène est réglementaire : il se suit en entier, quel que soit le niveau. */
export const HEURES_HYGIENE_INCOMPRESSIBLES = 14

export type NiveauReponse = 0 | 1 | 2 | 3

/** Les quatre niveaux de maîtrise, du plus faible au plus fort. */
export const NIVEAUX: { valeur: NiveauReponse; libelle: string; detail: string }[] = [
  { valeur: 0, libelle: 'Jamais fait', detail: "Le candidat n'a jamais été confronté à la situation" },
  { valeur: 1, libelle: 'Notions', detail: 'Il en a entendu parler, sans pratique réelle' },
  { valeur: 2, libelle: 'Sait faire accompagné', detail: "Il y parvient avec l'aide d'un référent" },
  { valeur: 3, libelle: 'Autonome', detail: 'Il réalise seul, au rythme attendu en service' },
]

export interface Question {
  code: string
  domaine: string
  intitule: string
  /** Ce que le formateur observe pour trancher entre deux niveaux. */
  repere?: string
}

export interface Domaine {
  code: string
  libelle: string
  /** Heures du parcours consacrées à ce domaine quand tout est à construire. */
  heures: number
  /** Compétence réglementaire : le volume ne descend pas sous un plancher. */
  plancher?: number
  objectif: string
}

export const DOMAINES: Domaine[] = [
  {
    code: 'hygiene',
    libelle: 'Hygiène alimentaire et HACCP',
    heures: 35,
    plancher: HEURES_HYGIENE_INCOMPRESSIBLES,
    objectif: "Appliquer le plan de maîtrise sanitaire : températures, DLC, marche en avant, traçabilité, nettoyage et désinfection.",
  },
  {
    code: 'production',
    libelle: 'Production et assemblage',
    heures: 35,
    objectif: "Préparer, cuire et assembler les produits selon les fiches techniques, tenir les cadences et maîtriser les cuissons.",
  },
  {
    code: 'service',
    libelle: 'Service, encaissement et relation client',
    heures: 28,
    objectif: "Accueillir, prendre une commande, encaisser, gérer une réclamation et tenir le rythme au comptoir comme au drive.",
  },
  {
    code: 'securite',
    libelle: 'Sécurité au travail et prévention des risques',
    heures: 21,
    objectif: "Travailler sans se blesser ni blesser autrui : gestes et postures, équipements chauds et tranchants, conduite à tenir en cas d'incident.",
  },
  {
    code: 'posture',
    libelle: 'Travail en équipe et posture professionnelle',
    heures: 21,
    objectif: "Tenir un poste dans un collectif : communication en service, ponctualité, transmission des consignes, tenue et présentation.",
  },
]

/** Vingt situations de travail, quatre par domaine. */
export const QUESTIONS: Question[] = [
  // Hygiène alimentaire et HACCP
  { code: 'hyg1', domaine: 'hygiene', intitule: 'Se laver les mains et gérer sa tenue de travail aux moments imposés', repere: 'Cite les moments obligatoires sans hésiter' },
  { code: 'hyg2', domaine: 'hygiene', intitule: 'Relever et consigner les températures des enceintes froides et chaudes', repere: 'Sait où lire, quoi noter, et ce qui déclenche une alerte' },
  { code: 'hyg3', domaine: 'hygiene', intitule: 'Contrôler les dates limites de consommation et gérer les rotations', repere: 'Applique le premier entré, premier sorti sans qu\'on le lui rappelle' },
  { code: 'hyg4', domaine: 'hygiene', intitule: 'Réaliser un nettoyage et une désinfection selon le plan affiché', repere: 'Respecte dosage, temps de contact et ordre des surfaces' },
  // Production et assemblage
  { code: 'pro1', domaine: 'production', intitule: 'Préparer un poste de travail avant le service', repere: 'Anticipe les quantités et vérifie ses équipements' },
  { code: 'pro2', domaine: 'production', intitule: 'Suivre une fiche technique pour assembler un produit', repere: 'Le produit sorti est conforme, deux fois sur deux' },
  { code: 'pro3', domaine: 'production', intitule: 'Maîtriser les cuissons et les temps de maintien', repere: 'Sait reconnaître un produit à jeter' },
  { code: 'pro4', domaine: 'production', intitule: 'Tenir la cadence en coup de feu sans dégrader la qualité', repere: 'Garde son poste organisé quand les commandes s\'accumulent' },
  // Service, encaissement et relation client
  { code: 'ser1', domaine: 'service', intitule: 'Accueillir un client et prendre une commande complète', repere: 'Reformule et propose sans réciter' },
  { code: 'ser2', domaine: 'service', intitule: 'Encaisser, rendre la monnaie et clôturer une caisse', repere: 'Gère les moyens de paiement et repère une erreur de caisse' },
  { code: 'ser3', domaine: 'service', intitule: 'Répondre à une réclamation sans faire monter le ton', repere: 'Sait quand passer le relais au responsable' },
  { code: 'ser4', domaine: 'service', intitule: 'Tenir un poste drive ou comptoir aux heures de pointe', repere: 'Garde une cadence tenable et annonce ses ruptures' },
  // Sécurité au travail
  { code: 'sec1', domaine: 'securite', intitule: 'Adopter les gestes et postures pour porter et se déplacer', repere: 'Plie les jambes, ne charge pas au-delà du raisonnable' },
  { code: 'sec2', domaine: 'securite', intitule: 'Utiliser friteuse, four et matériel chaud en sécurité', repere: 'Connaît la conduite à tenir en cas de brûlure ou de départ de feu' },
  { code: 'sec3', domaine: 'securite', intitule: 'Manipuler couteaux, trancheuse et matériel tranchant', repere: 'Range et nettoie sans se mettre en danger' },
  { code: 'sec4', domaine: 'securite', intitule: 'Repérer un risque et alerter la bonne personne', repere: 'Sait ce qu\'est un sol glissant signalé, et qui prévenir' },
  // Posture professionnelle
  { code: 'pos1', domaine: 'posture', intitule: 'Communiquer avec l\'équipe pendant le service', repere: 'Annonce, confirme, ne laisse pas une information en suspens' },
  { code: 'pos2', domaine: 'posture', intitule: 'Respecter les horaires, les pauses et prévenir en cas d\'imprévu', repere: 'A déjà tenu un rythme de travail régulier' },
  { code: 'pos3', domaine: 'posture', intitule: 'Recevoir une consigne ou une correction et l\'appliquer', repere: 'Reformule plutôt que d\'acquiescer sans comprendre' },
  { code: 'pos4', domaine: 'posture', intitule: 'Se présenter et tenir une posture professionnelle face au client', repere: 'Tenue, langage et disponibilité conformes à l\'enseigne' },
]

export type Reponses = Record<string, NiveauReponse | null | undefined>

export interface ResultatDomaine {
  code: string
  libelle: string
  objectif: string
  /** Somme des niveaux obtenus sur ce domaine. */
  points: number
  /** Points possibles : 3 par question. */
  pointsMax: number
  /** Maîtrise en pourcentage, 0 quand rien n'est acquis. */
  maitrise: number
  /** Écart au référentiel, en pourcentage. */
  ecart: number
  heuresReferentiel: number
  heuresPreconisees: number
  /** Questions restées sans réponse. */
  nonRenseignees: number
}

export interface ResultatPositionnement {
  domaines: ResultatDomaine[]
  /** Maîtrise globale, moyenne pondérée par les heures du référentiel. */
  maitriseGlobale: number
  niveau: 'debutant' | 'initie' | 'intermediaire' | 'autonome'
  niveauLibelle: string
  heuresPreconisees: number
  heuresReferentiel: number
  /** Toutes les questions ont une réponse. */
  complet: boolean
  nbReponses: number
  nbQuestions: number
}

const arrondiDemiHeure = (h: number) => Math.round(h * 2) / 2

/** Niveau d'ensemble, tel qu'il sera lu par le financeur. */
function niveauDe(maitrise: number): { cle: ResultatPositionnement['niveau']; libelle: string } {
  if (maitrise < 25) return { cle: 'debutant', libelle: 'Débutant — découverte du métier' }
  if (maitrise < 50) return { cle: 'initie', libelle: 'Initié — premières notions, pratique à construire' }
  if (maitrise < 75) return { cle: 'intermediaire', libelle: 'Intermédiaire — sait faire accompagné' }
  return { cle: 'autonome', libelle: 'Autonome — tient le poste sans appui' }
}

/**
 * Évalue un positionnement : maîtrise par domaine, écart au référentiel et
 * volume d'heures préconisé.
 *
 * Les heures d'un domaine sont proportionnelles à ce qui reste à construire :
 * un candidat autonome sur un domaine n'a pas besoin d'y passer le volume
 * complet. Le module hygiène ne descend jamais sous son plancher réglementaire.
 * Une question sans réponse compte comme non acquise : on ne préjuge pas d'un
 * niveau qu'on n'a pas mesuré.
 */
export function evaluerPositionnement(reponses: Reponses): ResultatPositionnement {
  const domaines: ResultatDomaine[] = DOMAINES.map((d) => {
    const questions = QUESTIONS.filter((q) => q.domaine === d.code)
    const pointsMax = questions.length * 3
    let points = 0
    let nonRenseignees = 0
    for (const q of questions) {
      const r = reponses[q.code]
      if (r === null || r === undefined) { nonRenseignees++; continue }
      points += Math.max(0, Math.min(3, Number(r)))
    }
    const maitrise = pointsMax ? Math.round((points / pointsMax) * 1000) / 10 : 0
    const ecart = Math.round((100 - maitrise) * 10) / 10
    const brut = d.heures * (ecart / 100)
    const heuresPreconisees = arrondiDemiHeure(Math.max(brut, d.plancher ?? 0))
    return {
      code: d.code, libelle: d.libelle, objectif: d.objectif,
      points, pointsMax, maitrise, ecart,
      heuresReferentiel: d.heures,
      heuresPreconisees: Math.min(heuresPreconisees, d.heures),
      nonRenseignees,
    }
  })

  const totalHeuresRef = DOMAINES.reduce((t, d) => t + d.heures, 0)
  // Pondération par les heures : un écart sur l'hygiène pèse plus qu'un écart
  // sur la posture, puisque le parcours y consacre davantage de temps.
  const maitriseGlobale = Math.round(
    (domaines.reduce((t, d) => t + d.maitrise * d.heuresReferentiel, 0) / totalHeuresRef) * 10,
  ) / 10
  const n = niveauDe(maitriseGlobale)
  const nbReponses = QUESTIONS.filter((q) => reponses[q.code] !== null && reponses[q.code] !== undefined).length

  return {
    domaines,
    maitriseGlobale,
    niveau: n.cle,
    niveauLibelle: n.libelle,
    heuresPreconisees: arrondiDemiHeure(domaines.reduce((t, d) => t + d.heuresPreconisees, 0)),
    heuresReferentiel: totalHeuresRef,
    complet: nbReponses === QUESTIONS.length,
    nbReponses,
    nbQuestions: QUESTIONS.length,
  }
}

/** Phrase de synthèse pour le dossier France Travail. */
export function syntheseFranceTravail(r: ResultatPositionnement): string {
  const manque = r.heuresReferentiel - r.heuresPreconisees
  if (r.heuresPreconisees >= r.heuresReferentiel) {
    return `Le positionnement situe le candidat à ${r.maitriseGlobale} % du référentiel de compétences. L'écart mesuré couvre l'intégralité des ${r.heuresReferentiel} heures du parcours.`
  }
  return `Le positionnement situe le candidat à ${r.maitriseGlobale} % du référentiel de compétences. L'écart mesuré justifie ${r.heuresPreconisees} heures de formation sur les ${r.heuresReferentiel} heures du parcours, soit ${arrondiDemiHeure(manque)} heures déjà acquises.`
}
