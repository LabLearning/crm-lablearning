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

/**
 * Une question du positionnement : quatre propositions, une seule correcte.
 * Le candidat répond lui-même, depuis son téléphone ; le score se déduit de
 * ses réponses, pas d'une appréciation.
 */
export interface Question {
  code: string
  domaine: string
  intitule: string
  choix: string[]
  /** Index de la bonne réponse dans `choix`. */
  correct: number
  /** Affichée après coup : le positionnement sert aussi à apprendre. */
  explication: string
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

/** Vingt questions, quatre par domaine, une seule bonne réponse par question. */
export const QUESTIONS: Question[] = [
  // ── Hygiène alimentaire et HACCP ──
  {
    code: 'hyg1', domaine: 'hygiene',
    intitule: 'À quelle température doit être conservé un produit frais en réfrigérateur professionnel ?',
    choix: ['Entre 0 et 4 °C', 'Entre 8 et 12 °C', 'Entre 15 et 18 °C', 'Peu importe, tant que c\'est froid'],
    correct: 0,
    explication: 'Les denrées très périssables se conservent entre 0 et 4 °C. Au-delà, les bactéries se multiplient rapidement.',
  },
  {
    code: 'hyg2', domaine: 'hygiene',
    intitule: 'Que signifie la « marche en avant » en cuisine ?',
    choix: [
      'Servir les clients dans leur ordre d\'arrivée',
      'Le produit avance du sale vers le propre sans jamais revenir en arrière',
      'Avancer les dates de péremption sur les étiquettes',
      'Travailler debout face au plan de travail',
    ],
    correct: 1,
    explication: 'La marche en avant évite qu\'un produit propre croise une zone ou un produit souillé.',
  },
  {
    code: 'hyg3', domaine: 'hygiene',
    intitule: 'Un produit porte une DLC dépassée d\'un jour. Que faites-vous ?',
    choix: [
      'Je le vends si son aspect est normal',
      'Je le recongèle pour plus tard',
      'Je le jette et je le note sur le registre',
      'Je demande au client s\'il l\'accepte',
    ],
    correct: 2,
    explication: 'Une DLC dépassée signifie retrait immédiat, quelle que soit l\'apparence du produit. La sortie se trace.',
  },
  {
    code: 'hyg4', domaine: 'hygiene',
    intitule: 'Après avoir manipulé de la viande crue, que faites-vous avant de toucher un produit cuit ?',
    choix: [
      'Je m\'essuie les mains sur mon tablier',
      'Je me lave les mains et je change de planche et d\'ustensile',
      'Je rince la planche à l\'eau froide',
      'Rien, si je vais vite',
    ],
    correct: 1,
    explication: 'C\'est la règle contre la contamination croisée : mains lavées, matériel changé ou désinfecté.',
  },
  // ── Production et assemblage ──
  {
    code: 'pro1', domaine: 'production',
    intitule: 'À quoi sert une fiche technique produit ?',
    choix: [
      'À afficher le prix de vente au client',
      'À décrire les ingrédients, les quantités et le montage attendus',
      'À noter les commandes du jour',
      'À enregistrer les températures du frigo',
    ],
    correct: 1,
    explication: 'La fiche technique garantit qu\'un produit est identique quel que soit l\'équipier qui le prépare.',
  },
  {
    code: 'pro2', domaine: 'production',
    intitule: 'Un steak sort de cuisson. Comment vérifier qu\'il est bon à servir ?',
    choix: [
      'Je regarde sa couleur en surface',
      'Je me fie au minuteur uniquement',
      'Je contrôle la température à cœur avec une sonde',
      'Je le goûte',
    ],
    correct: 2,
    explication: 'Seule la température à cœur garantit la cuisson. La couleur et le temps ne suffisent pas.',
  },
  {
    code: 'pro3', domaine: 'production',
    intitule: 'Que veut dire « mettre en place » son poste avant le service ?',
    choix: [
      'Nettoyer la salle',
      'Préparer et vérifier produits, matériel et quantités avant le rush',
      'Prendre sa pause avant le coup de feu',
      'Compter la caisse',
    ],
    correct: 1,
    explication: 'Une mise en place sérieuse évite les ruptures et les erreurs au moment où les commandes s\'enchaînent.',
  },
  {
    code: 'pro4', domaine: 'production',
    intitule: 'En plein coup de feu, vous vous apercevez qu\'un produit est mal assemblé. Que faites-vous ?',
    choix: [
      'Je le sers quand même pour ne pas perdre de temps',
      'Je le refais, même si cela prend trente secondes de plus',
      'Je le donne à un collègue pour qu\'il décide',
      'Je le mets de côté pour la fin du service',
    ],
    correct: 1,
    explication: 'La cadence ne justifie jamais un produit non conforme : c\'est le client qui le verra.',
  },
  // ── Service, encaissement et relation client ──
  {
    code: 'ser1', domaine: 'service',
    intitule: 'Un client passe commande. Quel est le bon réflexe avant de valider ?',
    choix: [
      'Encaisser tout de suite',
      'Reformuler la commande à voix haute pour confirmer',
      'Appeler le responsable',
      'Attendre qu\'il répète',
    ],
    correct: 1,
    explication: 'La reformulation évite l\'essentiel des erreurs de commande, surtout au drive.',
  },
  {
    code: 'ser2', domaine: 'service',
    intitule: 'Un client vous rend 20 € pour une commande de 13,50 €. Combien rendez-vous ?',
    choix: ['6,50 €', '7,50 €', '6,00 €', '7,00 €'],
    correct: 0,
    explication: '20,00 − 13,50 = 6,50 €. Le rendu de monnaie fait partie du poste de caisse.',
  },
  {
    code: 'ser3', domaine: 'service',
    intitule: 'Un client se plaint fortement de son plat devant la file d\'attente. Que faites-vous ?',
    choix: [
      'Je lui explique qu\'il a tort',
      'Je l\'écoute, je m\'excuse et je propose une solution ou j\'appelle le responsable',
      'Je l\'ignore pour servir les suivants',
      'Je lui demande de revenir plus tard',
    ],
    correct: 1,
    explication: 'Écouter, s\'excuser, proposer : on désamorce sans se justifier, et on passe le relais si nécessaire.',
  },
  {
    code: 'ser4', domaine: 'service',
    intitule: 'Un produit est en rupture pendant le service. Quelle est la bonne conduite ?',
    choix: [
      'Je le laisse à la carte et je verrai bien',
      'Je préviens immédiatement l\'équipe et je propose une alternative au client',
      'Je sers autre chose sans prévenir',
      'J\'attends que quelqu\'un s\'en rende compte',
    ],
    correct: 1,
    explication: 'Une rupture annoncée tout de suite évite les commandes impossibles et les clients mécontents.',
  },
  // ── Sécurité au travail ──
  {
    code: 'sec1', domaine: 'securite',
    intitule: 'Comment soulever une charge lourde au sol sans se blesser ?',
    choix: [
      'En me penchant en avant, dos arrondi',
      'En pliant les jambes et en gardant le dos droit',
      'En tirant d\'un coup sec',
      'En la faisant glisser avec le pied',
    ],
    correct: 1,
    explication: 'Plier les jambes et garder le dos droit protège les lombaires, premier motif d\'arrêt en restauration.',
  },
  {
    code: 'sec2', domaine: 'securite',
    intitule: 'De l\'huile prend feu dans la friteuse. Que faites-vous en premier ?',
    choix: [
      'Je jette de l\'eau dessus',
      'Je coupe l\'alimentation et j\'étouffe le feu avec un couvercle ou une couverture anti-feu',
      'Je sors la cuve à l\'extérieur',
      'Je souffle dessus',
    ],
    correct: 1,
    explication: 'L\'eau sur l\'huile enflammée provoque une explosion. On coupe l\'énergie et on étouffe.',
  },
  {
    code: 'sec3', domaine: 'securite',
    intitule: 'Un couteau vous échappe des mains. Quel est le bon réflexe ?',
    choix: [
      'Je le rattrape au vol',
      'Je recule et je le laisse tomber',
      'Je le bloque avec le pied',
      'Je le pousse vers le collègue',
    ],
    correct: 1,
    explication: 'On ne rattrape jamais une lame : on s\'écarte, on ramasse ensuite par le manche.',
  },
  {
    code: 'sec4', domaine: 'securite',
    intitule: 'Vous constatez un sol mouillé en zone de passage. Que faites-vous ?',
    choix: [
      'Je préviens à l\'oral et je continue mon service',
      'Je signale avec un panneau, j\'essuie ou je fais essuyer sans attendre',
      'J\'attends la fin du service pour nettoyer',
      'Je contourne la zone',
    ],
    correct: 1,
    explication: 'La chute de plain-pied est l\'accident le plus fréquent du secteur : signaler et sécher tout de suite.',
  },
  // ── Posture professionnelle ──
  {
    code: 'pos1', domaine: 'posture',
    intitule: 'Vous allez avoir quinze minutes de retard. Que faites-vous ?',
    choix: [
      'Je préviens le responsable dès que je le sais',
      'Je me dépêche sans rien dire',
      'Je préviens un collègue en arrivant',
      'Je rattrape le temps sur ma pause',
    ],
    correct: 0,
    explication: 'Prévenir tôt permet de réorganiser le service. C\'est le premier critère de fiabilité d\'un équipier.',
  },
  {
    code: 'pos2', domaine: 'posture',
    intitule: 'Un responsable vous fait une remarque sur votre façon de travailler. Quelle réaction est attendue ?',
    choix: [
      'Me justifier immédiatement',
      'Écouter, reformuler pour vérifier que j\'ai compris, appliquer',
      'Ne rien dire et faire comme avant',
      'En parler aux collègues ensuite',
    ],
    correct: 1,
    explication: 'Une consigne reformulée est une consigne comprise. C\'est ce qu\'on observe pendant la période d\'essai.',
  },
  {
    code: 'pos3', domaine: 'posture',
    intitule: 'Vous terminez votre service et un collègue prend la suite. Que faites-vous ?',
    choix: [
      'Je pars dès l\'heure atteinte',
      'Je transmets ce qui est en cours, les ruptures et les points d\'attention',
      'Je lui laisse un mot si j\'ai le temps',
      'Je le préviens le lendemain',
    ],
    correct: 1,
    explication: 'La passation est ce qui évite qu\'un problème traverse deux services sans être traité.',
  },
  {
    code: 'pos4', domaine: 'posture',
    intitule: 'Qu\'attend-on de votre tenue et de votre présentation face au client ?',
    choix: [
      'Une tenue personnelle, l\'important étant d\'être à l\'aise',
      'La tenue de l\'enseigne, propre, cheveux attachés et bijoux retirés',
      'Une tenue de ville correcte',
      'Peu importe en cuisine',
    ],
    correct: 1,
    explication: 'La tenue relève à la fois de l\'hygiène et de l\'image de l\'enseigne : elle n\'est pas négociable.',
  },
]

/** Réponses du candidat : code de question → index du choix retenu. */
export type Reponses = Record<string, number | null | undefined>

export interface ResultatDomaine {
  code: string
  libelle: string
  objectif: string
  /** Bonnes réponses sur ce domaine. */
  justes: number
  /** Questions du domaine. */
  total: number
  /** Réussite en pourcentage. */
  maitrise: number
  /** Écart au référentiel, en pourcentage. */
  ecart: number
  heuresReferentiel: number
  heuresPreconisees: number
  nonRepondues: number
}

export interface ResultatPositionnement {
  domaines: ResultatDomaine[]
  /** Note sur 20, telle qu'elle est lue par le candidat et le financeur. */
  note: number
  /** Réussite globale, pondérée par les heures du référentiel. */
  maitriseGlobale: number
  justes: number
  niveau: 'debutant' | 'initie' | 'intermediaire' | 'autonome'
  niveauLibelle: string
  heuresPreconisees: number
  heuresReferentiel: number
  complet: boolean
  nbReponses: number
  nbQuestions: number
}

const arrondiDemiHeure = (h: number) => Math.round(h * 2) / 2

/** Niveau d'ensemble, tel qu'il sera lu par le financeur. */
function niveauDe(maitrise: number): { cle: ResultatPositionnement['niveau']; libelle: string } {
  if (maitrise < 25) return { cle: 'debutant', libelle: 'Débutant — découverte du métier' }
  if (maitrise < 50) return { cle: 'initie', libelle: 'Initié — premières notions, pratique à construire' }
  if (maitrise < 75) return { cle: 'intermediaire', libelle: 'Intermédiaire — bases acquises, à consolider' }
  return { cle: 'autonome', libelle: 'Avancé — connaissances du poste maîtrisées' }
}

/** Vrai si la réponse donnée est la bonne. */
export function estJuste(question: Question, reponse: number | null | undefined): boolean {
  return reponse !== null && reponse !== undefined && Number(reponse) === question.correct
}

/**
 * Corrige le questionnaire : réussite par domaine, écart au référentiel et
 * volume d'heures que cet écart justifie.
 *
 * Les heures d'un domaine sont proportionnelles à ce qui reste à construire :
 * un candidat qui répond juste partout n'a pas besoin du volume complet. Le
 * module hygiène ne descend jamais sous son plancher réglementaire. Une
 * question sans réponse compte comme fausse : on ne préjuge pas d'un acquis
 * qu'on n'a pas mesuré.
 */
export function evaluerPositionnement(reponses: Reponses): ResultatPositionnement {
  const domaines: ResultatDomaine[] = DOMAINES.map((d) => {
    const questions = QUESTIONS.filter((q) => q.domaine === d.code)
    let justes = 0
    let nonRepondues = 0
    for (const q of questions) {
      const r = reponses[q.code]
      if (r === null || r === undefined) { nonRepondues++; continue }
      if (estJuste(q, r)) justes++
    }
    const total = questions.length
    const maitrise = total ? Math.round((justes / total) * 1000) / 10 : 0
    const ecart = Math.round((100 - maitrise) * 10) / 10
    const brut = d.heures * (ecart / 100)
    const heuresPreconisees = arrondiDemiHeure(Math.max(brut, d.plancher ?? 0))
    return {
      code: d.code, libelle: d.libelle, objectif: d.objectif,
      justes, total, maitrise, ecart,
      heuresReferentiel: d.heures,
      heuresPreconisees: Math.min(heuresPreconisees, d.heures),
      nonRepondues,
    }
  })

  const totalHeuresRef = DOMAINES.reduce((t, d) => t + d.heures, 0)
  // Pondération par les heures : une lacune en hygiène pèse plus qu'une lacune
  // sur la posture, puisque le parcours y consacre davantage de temps.
  const maitriseGlobale = Math.round(
    (domaines.reduce((t, d) => t + d.maitrise * d.heuresReferentiel, 0) / totalHeuresRef) * 10,
  ) / 10
  const justes = domaines.reduce((t, d) => t + d.justes, 0)
  const n = niveauDe(maitriseGlobale)
  const nbReponses = QUESTIONS.filter((q) => reponses[q.code] !== null && reponses[q.code] !== undefined).length

  return {
    domaines,
    note: Math.round((justes / QUESTIONS.length) * 20 * 10) / 10,
    maitriseGlobale,
    justes,
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
  const base = `Le questionnaire de positionnement situe le candidat à ${r.justes} bonnes réponses sur ${r.nbQuestions}, soit ${r.note}/20 et ${r.maitriseGlobale} % du référentiel de compétences.`
  if (r.heuresPreconisees >= r.heuresReferentiel) {
    return `${base} L'écart mesuré couvre l'intégralité des ${r.heuresReferentiel} heures du parcours.`
  }
  return `${base} L'écart mesuré justifie ${r.heuresPreconisees} heures de formation sur les ${r.heuresReferentiel} heures du parcours.`
}
