/**
 * Types communs aux questionnaires de positionnement POEI
 * (lib/poei-positionnement.ts et les banques de ce dossier).
 */

/**
 * Une question du positionnement : quatre propositions, une seule correcte.
 * Le candidat répond lui-même, depuis son téléphone ; le score se déduit de
 * ses réponses, pas d'une appréciation.
 */
export interface Question {
  code: string
  domaine: string
  /** Compétence du référentiel mesurée par la question, ex. « 13 · Assemblage d'un tacos ou produit snacking » */
  competence?: string
  intitule: string
  choix: string[]
  /** Index de la bonne réponse dans `choix`. */
  correct: number
  /** Montrée au gestionnaire et au formateur, jamais au candidat. */
  explication: string
  /** Texte réglementaire ou référence professionnelle qui fonde la réponse. */
  source?: string
}

export interface Domaine {
  code: string
  libelle: string
  /** Compétences du référentiel couvertes, ex. « 01 à 02 » */
  competences?: string
  /** Part du parcours consacrée à ce domaine quand tout est à construire (la somme des parts vaut 1). */
  part: number
  /** Volume que ce domaine ne descend jamais sous, en heures, même pour un candidat avancé. */
  plancher?: number
  /** Raison du plancher, reprise dans la fiche France Travail. */
  plancherMotif?: string
  objectif: string
}

export type CodeQuestionnaire = 'tacos' | 'generique'

export interface Questionnaire {
  code: CodeQuestionnaire
  /** Titre court, ex. « Équipier polyvalent, concepts tacos » */
  titre: string
  /** Référentiel sur lequel les questions sont construites, cité dans la fiche France Travail. */
  referentiel: string
  /** Durée annoncée au candidat, en minutes. */
  dureeMinutes: number
  domaines: Domaine[]
  questions: Question[]
}

/** Ce que l'écran du candidat reçoit : ni la bonne réponse, ni l'explication. */
export interface QuestionPublique {
  code: string
  domaine: string
  intitule: string
  choix: string[]
}

export interface DomainePublic {
  code: string
  libelle: string
  objectif: string
}
