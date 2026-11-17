/**
 * Positionnement à l'entrée d'un parcours POEI d'équipier polyvalent.
 *
 * France Travail finance un volume d'heures : il faut pouvoir montrer, candidat
 * par candidat, l'écart entre son niveau d'entrée et le référentiel de
 * compétences du poste. Le questionnaire situe le candidat domaine par
 * domaine ; les heures préconisées se déduisent de l'écart mesuré.
 *
 * Un questionnaire par famille de concepts, choisi d'après le parcours :
 *   - « tacos » (Chamas Tacos, New School Tacos) : référentiel en six domaines
 *     et quarante compétences, une question par compétence ;
 *   - « générique » : première version en cinq domaines et vingt questions,
 *     servie aux concepts qui n'ont pas encore leur banque (Chickeez,
 *     Dreams Donuts…) et aux positionnements déjà rendus avec elle.
 *
 * Les heures de chaque domaine sont une part de la durée réelle du parcours :
 * leur somme vaut toujours cette durée, qu'il fasse 35, 105 ou 140 heures.
 *
 * La règle est un seuil : en dessous de 80 % de bonnes réponses, le candidat
 * suit le parcours complet. Au-dessus, seul l'écart restant est à former, sans
 * descendre sous les planchers (hygiène, évaluation finale).
 */

import type { CodeQuestionnaire, Domaine, DomainePublic, Question, QuestionPublique, Questionnaire } from './positionnement-banques/types'
import { QUESTIONNAIRE_TACOS } from './positionnement-banques/tacos'
import { QUESTIONNAIRE_GENERIQUE } from './positionnement-banques/generique'

export type { CodeQuestionnaire, Domaine, DomainePublic, Question, QuestionPublique, Questionnaire }

/** Durée retenue quand le parcours n'en renseigne pas. */
export const DUREE_PARCOURS_REFERENCE = 140

/** Part de bonnes réponses à partir de laquelle le parcours complet n'est plus requis. */
export const SEUIL_REUSSITE = 80

export const QUESTIONNAIRES: Record<CodeQuestionnaire, Questionnaire> = {
  tacos: QUESTIONNAIRE_TACOS,
  generique: QUESTIONNAIRE_GENERIQUE,
}

export function questionnaire(code: string | null | undefined): Questionnaire {
  return (code && QUESTIONNAIRES[code as CodeQuestionnaire]) || QUESTIONNAIRE_GENERIQUE
}

/** Concept tacos : Chamas Tacos, New School Tacos (NST), ou tout parcours dont la formation parle de tacos. */
const CONCEPT_TACOS = /chamas|new\s*school|\bnst\b|tacos/i

/**
 * Questionnaire d'un parcours, d'après l'intitulé de sa formation, à défaut
 * le nom de l'entreprise. Les concepts sans banque propre reçoivent le
 * questionnaire générique.
 */
export function questionnairePourParcours(p: { formation?: string | null; entreprise?: string | null }): Questionnaire {
  const texte = `${p.formation || ''} ${p.entreprise || ''}`
  return CONCEPT_TACOS.test(texte) ? QUESTIONNAIRE_TACOS : QUESTIONNAIRE_GENERIQUE
}

/**
 * Questionnaire auquel un candidat a répondu : celui figé dans ses résultats,
 * sinon celui que désignent les codes de ses réponses (les positionnements
 * rendus avant le 17/11/2026 n'enregistraient pas le questionnaire), sinon
 * celui du parcours.
 */
export function questionnaireDuPositionnement(
  resultats: { questionnaire?: string | null } | null | undefined,
  reponses: Reponses | null | undefined,
  parcours: Questionnaire,
): Questionnaire {
  if (resultats?.questionnaire && QUESTIONNAIRES[resultats.questionnaire as CodeQuestionnaire]) {
    return QUESTIONNAIRES[resultats.questionnaire as CodeQuestionnaire]
  }
  const codes = Object.keys(reponses || {})
  if (codes.length) {
    for (const q of Object.values(QUESTIONNAIRES)) {
      if (codes.some((c) => q.questions.some((x) => x.code === c))) return q
    }
  }
  return parcours
}

/** Ce que l'écran du candidat reçoit : ni bonne réponse, ni explication, ni source. */
export function versionPublique(q: Questionnaire): { questions: QuestionPublique[]; domaines: DomainePublic[] } {
  return {
    questions: q.questions.map(({ code, domaine, intitule, choix }) => ({ code, domaine, intitule, choix })),
    domaines: q.domaines.map(({ code, libelle, objectif }) => ({ code, libelle, objectif })),
  }
}

export type Reponses = Record<string, number | null | undefined>

export interface ResultatDomaine {
  code: string
  libelle: string
  objectif: string
  competences?: string
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
  /** Plancher appliqué à ce domaine, en heures, et sa raison. */
  plancher?: number
  plancherMotif?: string
  nonRepondues: number
}

export interface ResultatPositionnement {
  /** Questionnaire corrigé (figé avec les résultats). */
  questionnaire: CodeQuestionnaire
  /** Durée du parcours sur laquelle les heures ont été réparties. */
  dureeParcours: number
  domaines: ResultatDomaine[]
  /** Note sur 20, telle qu'elle est lue par le financeur. */
  note: number
  /** Réussite globale. */
  maitriseGlobale: number
  justes: number
  niveau: 'debutant' | 'initie' | 'intermediaire' | 'autonome'
  niveauLibelle: string
  heuresPreconisees: number
  heuresReferentiel: number
  /** Vrai à partir de SEUIL_REUSSITE % de bonnes réponses. */
  seuilAtteint: boolean
  seuil: number
  complet: boolean
  nbReponses: number
  nbQuestions: number
}

const arrondiDemiHeure = (h: number) => Math.round(h * 2) / 2

/**
 * Répartit une durée entre les domaines selon leurs parts, par demi-heure,
 * sans rien perdre : la somme vaut exactement la durée (méthode du plus fort reste).
 */
export function repartirHeures(duree: number, parts: number[]): number[] {
  const demi = Math.round(duree * 2)
  const totalParts = parts.reduce((t, p) => t + p, 0) || 1
  const exacts = parts.map((p) => (demi * p) / totalParts)
  const base = exacts.map((x) => Math.floor(x))
  let reste = demi - base.reduce((t, x) => t + x, 0)
  const ordre = exacts.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)
  for (let k = 0; reste > 0 && k < ordre.length; k++, reste--) base[ordre[k].i]++
  return base.map((x) => x / 2)
}

/** Niveau d'ensemble, tel qu'il sera lu par le financeur. */
function niveauDe(maitrise: number): { cle: ResultatPositionnement['niveau']; libelle: string } {
  if (maitrise < 25) return { cle: 'debutant', libelle: 'Débutant : découverte du métier' }
  if (maitrise < 50) return { cle: 'initie', libelle: 'Initié : premières notions, pratique à construire' }
  if (maitrise < 75) return { cle: 'intermediaire', libelle: 'Intermédiaire : bases acquises, à consolider' }
  return { cle: 'autonome', libelle: 'Avancé : connaissances du poste maîtrisées' }
}

/** Vrai si la réponse donnée est la bonne. */
export function estJuste(question: Question, reponse: number | null | undefined): boolean {
  return reponse !== null && reponse !== undefined && Number(reponse) === question.correct
}

/** Ne garde que les codes du questionnaire et des index de choix plausibles. */
export function nettoyerReponses(q: Questionnaire, reponses: Reponses): Reponses {
  const propres: Reponses = {}
  for (const question of q.questions) {
    const v = reponses?.[question.code]
    if (v === null || v === undefined) continue
    const n = Number(v)
    if (Number.isInteger(n) && n >= 0 && n < question.choix.length) propres[question.code] = n
  }
  return propres
}

/**
 * Corrige le questionnaire : réussite par domaine, écart au référentiel et
 * volume d'heures que cet écart justifie, sur la durée réelle du parcours.
 *
 * En dessous du seuil de réussite, le parcours complet est requis : chaque
 * domaine est compté pour son volume entier. Au-dessus, les heures d'un
 * domaine sont proportionnelles à ce qui reste à construire, sans descendre
 * sous son plancher. Une question sans réponse compte comme fausse : on ne
 * préjuge pas d'un acquis qu'on n'a pas mesuré.
 */
export function evaluerPositionnement(reponses: Reponses, q: Questionnaire, dureeParcours?: number | null): ResultatPositionnement {
  const duree = Number(dureeParcours) > 0 ? Number(dureeParcours) : DUREE_PARCOURS_REFERENCE
  const justesTotal = q.questions.filter((x) => estJuste(x, reponses[x.code])).length
  const nbQuestions = q.questions.length
  const maitriseGlobale = nbQuestions ? Math.round((justesTotal / nbQuestions) * 1000) / 10 : 0
  const seuilAtteint = maitriseGlobale >= SEUIL_REUSSITE
  const heuresRef = repartirHeures(duree, q.domaines.map((d) => d.part))

  const domaines: ResultatDomaine[] = q.domaines.map((d, i) => {
    const questions = q.questions.filter((x) => x.domaine === d.code)
    let justes = 0
    let nonRepondues = 0
    for (const x of questions) {
      const r = reponses[x.code]
      if (r === null || r === undefined) { nonRepondues++; continue }
      if (estJuste(x, r)) justes++
    }
    const total = questions.length
    const maitrise = total ? Math.round((justes / total) * 1000) / 10 : 0
    const ecart = Math.round((100 - maitrise) * 10) / 10
    const reference = heuresRef[i]
    const plancher = d.plancher != null ? Math.min(d.plancher, reference) : 0
    const reduites = Math.min(arrondiDemiHeure(Math.max(reference * (ecart / 100), plancher)), reference)
    return {
      code: d.code, libelle: d.libelle, objectif: d.objectif, competences: d.competences,
      justes, total, maitrise, ecart,
      heuresReferentiel: reference,
      heuresPreconisees: seuilAtteint ? reduites : reference,
      plancher: d.plancher != null ? plancher : undefined,
      plancherMotif: d.plancherMotif,
      nonRepondues,
    }
  })

  const n = niveauDe(maitriseGlobale)
  const nbReponses = q.questions.filter((x) => reponses[x.code] !== null && reponses[x.code] !== undefined).length

  return {
    questionnaire: q.code,
    dureeParcours: duree,
    domaines,
    note: nbQuestions ? Math.round((justesTotal / nbQuestions) * 20 * 10) / 10 : 0,
    maitriseGlobale,
    justes: justesTotal,
    niveau: n.cle,
    niveauLibelle: n.libelle,
    heuresPreconisees: seuilAtteint ? arrondiDemiHeure(domaines.reduce((t, d) => t + d.heuresPreconisees, 0)) : duree,
    heuresReferentiel: duree,
    seuilAtteint,
    seuil: SEUIL_REUSSITE,
    complet: nbReponses === nbQuestions,
    nbReponses,
    nbQuestions,
  }
}

/** Phrase de synthèse pour le dossier France Travail. */
export function syntheseFranceTravail(r: ResultatPositionnement): string {
  const base = `Le questionnaire de positionnement situe le candidat à ${r.justes} bonnes réponses sur ${r.nbQuestions}, soit ${r.note}/20 et ${r.maitriseGlobale} % de réussite.`
  if (!r.seuilAtteint) {
    return `${base} Le seuil de ${r.seuil} % de bonnes réponses n'est pas atteint : le parcours complet de ${r.heuresReferentiel} heures est requis.`
  }
  if (r.heuresPreconisees >= r.heuresReferentiel) {
    return `${base} L'écart mesuré couvre l'intégralité des ${r.heuresReferentiel} heures du parcours.`
  }
  return `${base} Le seuil de ${r.seuil} % est atteint : l'écart restant justifie ${r.heuresPreconisees} heures de formation sur les ${r.heuresReferentiel} heures du parcours.`
}

/** Durée annoncée au candidat, en toutes lettres pour l'e-mail et l'accueil. */
export function dureeEnLettres(minutes: number): string {
  const mots: Record<number, string> = { 5: 'cinq', 10: 'dix', 15: 'quinze', 20: 'vingt', 25: 'vingt-cinq', 30: 'trente' }
  return `${mots[minutes] || minutes} minutes`
}
