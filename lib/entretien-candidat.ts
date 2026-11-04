/**
 * Entretien de présélection téléphonique d'un candidat du vivier.
 *
 * Trame reprise de la fiche « Chamas Tacos Cagnes-sur-Mer » (04/11/2026) et
 * rendue générique : l'enseigne, la ville et le poste viennent du candidat
 * (entreprise pressentie, projet POEI), le contrat proposé se choisit (CDI, CDD
 * ou apprentissage ; 24 h ou 35 h). Stocké dans candidats_vivier.entretien
 * (migration 171). Module sans import serveur : partagé client et serveur.
 */

export type TypeContrat = 'CDI' | 'CDD' | 'Apprentissage'
export const TYPES_CONTRAT: TypeContrat[] = ['CDI', 'CDD', 'Apprentissage']
export const DUREES_HEBDO = [24, 35] as const
export type DureeHebdo = (typeof DUREES_HEBDO)[number]

export type ReponseFermee = 'oui' | 'non' | 'a_voir'
export const REPONSES_FERMEES: { value: ReponseFermee; label: string }[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'a_voir', label: 'À voir' },
]

export type Decision = 'retenir' | 'approfondir' | 'non_retenu'
export const DECISIONS: { value: Decision; label: string; detail: string }[] = [
  { value: 'retenir', label: 'À retenir', detail: 'Proposer un entretien approfondi' },
  { value: 'approfondir', label: 'À approfondir', detail: 'Vérifier certains points' },
  { value: 'non_retenu', label: 'Non retenu(e)', detail: 'Inadéquation avec les exigences du poste' },
]

export const CRITERES: { id: string; label: string }[] = [
  { id: 'motivation', label: 'Motivation pour l’enseigne' },
  { id: 'cuisine', label: 'Expérience / potentiel en cuisine' },
  { id: 'adaptation', label: 'Rapidité et capacité d’adaptation' },
  { id: 'serieux', label: 'Sérieux et esprit d’équipe' },
  { id: 'disponibilites', label: 'Disponibilités' },
  { id: 'engagement', label: 'Engagement dans la formation' },
]
export const NOTE_MAX = 4

export type Partie = 'motivation' | 'experience' | 'disponibilites' | 'formation'

export interface Entretien {
  version: 1
  date: string
  recruteur: string
  disponibilite: string
  experience: string
  contrat_type: TypeContrat
  contrat_heures: DureeHebdo
  prise_de_poste: string
  formation_sans_objet: boolean
  /** Réponses aux questions fermées (oui, non, à voir) et à la question du trajet */
  reponses: Record<string, string>
  observations: Record<Partie, string>
  notes: Record<string, number | null>
  points_forts: string
  points_a_approfondir: string
  decision: Decision | null
}

export function entretienVide(defauts: Partial<Entretien> = {}): Entretien {
  return {
    version: 1,
    date: new Date().toISOString().slice(0, 10),
    recruteur: '',
    disponibilite: '',
    experience: '',
    contrat_type: 'CDI',
    contrat_heures: 24,
    prise_de_poste: '',
    formation_sans_objet: false,
    reponses: {},
    observations: { motivation: '', experience: '', disponibilites: '', formation: '' },
    notes: Object.fromEntries(CRITERES.map((c) => [c.id, null])),
    points_forts: '',
    points_a_approfondir: '',
    decision: null,
    ...defauts,
  }
}

export const libelleContrat = (e: Pick<Entretien, 'contrat_type' | 'contrat_heures'>) =>
  `${e.contrat_type === 'Apprentissage' ? 'Contrat d’apprentissage' : e.contrat_type} ${e.contrat_heures} h`

/** Total des notes posées, et nombre de critères notés */
export function totalEntretien(e: Pick<Entretien, 'notes'>): { total: number; notes: number; max: number } {
  const valeurs = CRITERES.map((c) => e.notes?.[c.id]).filter((n): n is number => typeof n === 'number')
  return { total: valeurs.reduce((s, n) => s + n, 0), notes: valeurs.length, max: CRITERES.length * NOTE_MAX }
}

/** Ce qu'on sait du poste : enseigne, ville, intitulé */
export interface ContexteEntretien { enseigne: string | null; ville: string | null; poste: string }

export interface QuestionEntretien {
  id: string
  texte: string
  /** fermee : oui, non, à voir ; courte : réponse en quelques mots ; ouverte : dans les observations */
  forme: 'fermee' | 'courte' | 'ouverte'
}

/** Les questions de chaque partie, avec l'enseigne, la ville et le contrat du candidat */
export function questionsEntretien(ctx: ContexteEntretien, e: Pick<Entretien, 'contrat_type' | 'contrat_heures' | 'prise_de_poste'>): Record<Partie, QuestionEntretien[]> {
  const restaurant = ctx.ville ? `au restaurant de ${ctx.ville}` : 'au restaurant'
  const priseDePoste = e.prise_de_poste.trim() ? `pour une prise de poste ${e.prise_de_poste.trim()}` : 'pour la prise de poste prévue'
  return {
    motivation: [
      { id: 'connait_enseigne', texte: 'Que connaissez-vous de notre enseigne et de notre concept ?', forme: 'ouverte' },
    ],
    experience: [
      { id: 'deja_travaille', texte: 'Avez-vous déjà travaillé en restauration, cuisine, vente ou dans un environnement dynamique ?', forme: 'fermee' },
      { id: 'preparation', texte: 'Avez-vous déjà effectué de la préparation alimentaire, de la cuisson ou de l’assemblage de produits ?', forme: 'fermee' },
    ],
    disponibilites: [
      { id: 'contrat_attentes', texte: `Le contrat proposé (${libelleContrat(e)} par semaine) correspond-il à vos attentes ?`, forme: 'fermee' },
      { id: 'soir_weekend', texte: 'Êtes-vous disponible en soirée et le week-end ?', forme: 'fermee' },
      { id: 'prise_de_poste', texte: `Êtes-vous disponible ${priseDePoste} ?`, forme: 'fermee' },
      { id: 'trajet', texte: `Comment vous rendez-vous ${restaurant} ?`, forme: 'courte' },
    ],
    formation: [
      { id: 'quatre_semaines', texte: 'Êtes-vous disponible pendant les quatre semaines complètes ?', forme: 'fermee' },
      { id: 'france_travail', texte: 'Êtes-vous inscrit(e) à France Travail ou prêt(e) à effectuer les démarches nécessaires ?', forme: 'fermee' },
      { id: 'etapes', texte: 'Avez-vous bien compris les différentes étapes du parcours de recrutement ?', forme: 'fermee' },
    ],
  }
}

/** Phrase d'accueil à lire au candidat */
export function phraseAccueil(ctx: ContexteEntretien): string {
  const lieu = ctx.enseigne ? `le restaurant ${ctx.enseigne}${ctx.ville ? ` de ${ctx.ville}` : ''}` : `le poste de ${ctx.poste.toLowerCase()}`
  return `Bonjour, je vous contacte concernant votre candidature pour ${lieu}. Je souhaite échanger quelques minutes avec vous sur votre parcours, vos motivations et vos disponibilités.`
}

export const PRESENTATION_FORMATION = 'Une semaine théorique (hygiène, sécurité, produits), puis trois semaines pratiques en restaurant (recettes, préparation, cuisson et service), avant le contrat proposé à l’issue de la formation.'

export const CONCLUSION = 'Merci pour cet échange. Nous allons étudier votre candidature et reviendrons vers vous concernant la suite du recrutement.'

export const RAPPEL_RECRUTEUR = 'Privilégier la motivation, la ponctualité, la résistance au rythme de la restauration rapide, la polyvalence et la capacité à travailler en équipe. L’expérience en restauration est un plus, mais ne doit pas être un critère éliminatoire puisque la formation est prévue.'

/**
 * Remet en forme un entretien venu du navigateur : champs connus seulement,
 * textes bornés, notes de 1 à 4, valeurs fermées vérifiées.
 */
export function nettoyerEntretien(brut: any): Entretien {
  const t = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')
  const base = entretienVide()
  const reponses: Record<string, string> = {}
  for (const [k, v] of Object.entries(brut?.reponses || {})) {
    if (typeof k === 'string' && k.length <= 40 && typeof v === 'string') reponses[k] = v.slice(0, 300)
  }
  const notes: Record<string, number | null> = {}
  for (const c of CRITERES) {
    const n = Number(brut?.notes?.[c.id])
    notes[c.id] = Number.isInteger(n) && n >= 1 && n <= NOTE_MAX ? n : null
  }
  const obs = brut?.observations || {}
  return {
    ...base,
    date: /^\d{4}-\d{2}-\d{2}$/.test(brut?.date) ? brut.date : base.date,
    recruteur: t(brut?.recruteur, 120),
    disponibilite: t(brut?.disponibilite, 300),
    experience: t(brut?.experience, 300),
    contrat_type: TYPES_CONTRAT.includes(brut?.contrat_type) ? brut.contrat_type : base.contrat_type,
    contrat_heures: (DUREES_HEBDO as readonly number[]).includes(Number(brut?.contrat_heures)) ? (Number(brut.contrat_heures) as DureeHebdo) : base.contrat_heures,
    prise_de_poste: t(brut?.prise_de_poste, 120),
    formation_sans_objet: brut?.formation_sans_objet === true,
    reponses,
    observations: { motivation: t(obs.motivation), experience: t(obs.experience), disponibilites: t(obs.disponibilites), formation: t(obs.formation) },
    notes,
    points_forts: t(brut?.points_forts),
    points_a_approfondir: t(brut?.points_a_approfondir),
    decision: DECISIONS.some((d) => d.value === brut?.decision) ? brut.decision : null,
  }
}
