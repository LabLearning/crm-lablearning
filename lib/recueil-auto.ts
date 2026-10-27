import { themeOf } from '@/lib/branches'
import { libelleVille } from '@/lib/campagnes/publics'
import { TEXTES, type SujetRecueil } from './recueil-textes'

/**
 * Recueil du besoin rempli automatiquement (indicateur Qualiopi 4).
 *
 * Demandes de Brahim (27/10/2026) : « en fonction de la formation chacun a un
 * besoin identique : celui qui veut faire une formation hygiène veut former
 * son équipe à l'hygiène » ; puis « que ce soit aléatoire, écrit par un
 * humain, que ça ne fasse pas IA, mais que ça reste le même pour chaque
 * activité ».
 *
 * Les phrases sont celles de lib/recueil-textes.ts : plusieurs façons, écrites
 * comme des notes de chargée de formation, de dire la même chose pour chaque
 * activité. Pour un dossier, la variante est tirée au hasard mais toujours la
 * même (tirage déterminé par l'identifiant de la session) : deux dossiers se
 * lisent différemment, un dossier ne change pas d'une heure à l'autre.
 * Les balises sont remplies avec les faits du dossier (client, session,
 * inscrits, formation), mis en forme comme on les écrirait à la main ; rien
 * n'est inventé. Aucun nom de participant dans la réponse sur le handicap (le
 * recueil peut être remis au commanditaire).
 *
 * Fonction pure : la lecture en base et l'enregistrement sont dans
 * lib/recueil-auto-serveur.ts.
 */

export interface FaitsRecueil {
  session: {
    /** Graine du tirage des variantes */
    id?: string | null
    reference?: string | null
    date_debut?: string | null
    date_fin?: string | null
    horaires_jours?: { date?: string; matin_debut?: string; matin_fin?: string; aprem_debut?: string; aprem_fin?: string }[] | null
    lieu?: string | null
    ville?: string | null
    modalite?: string | null
    type_session?: string | null
    places_max?: number | null
    intitule?: string | null
  }
  formation?: {
    intitule?: string | null
    analyse_besoin?: string | null
    objectifs_pedagogiques?: unknown
    public_vise?: string | null
    prerequis?: string | null
    duree_heures?: number | null
  } | null
  client?: {
    raison_sociale?: string | null
    nom_commercial?: string | null
    secteur_activite?: string | null
    ville?: string | null
    franchise?: string | null
  } | null
  /** Inscrits non annulés */
  inscrits: { poste?: string | null; type_contrat?: string | null; situation_handicap?: boolean | null }[]
}

export type ThemeRecueil = 'hygiene' | 'prevention' | 'management' | 'metier'

export const themeDuRecueil = (intitule: string | null | undefined): ThemeRecueil => {
  const t = themeOf(intitule || '')
  return (['hygiene', 'prevention', 'management', 'metier'].includes(t) ? t : 'metier') as ThemeRecueil
}

const net = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
const sansPoint = (v: string) => v.replace(/[\s.;:]+$/, '')

// ── Tirage stable ────────────────────────────────────────────────────────

/** Empreinte FNV-1a sur 32 bits : la même graine donne toujours la même variante */
function empreinte(texte: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
export function tirer<T>(liste: readonly T[], graine: string): T {
  return liste[empreinte(graine) % liste.length]
}

// ── Sujet de la formation (le besoin est le même pour toute une activité) ──

const SUJETS: { re: RegExp; sujet: SujetRecueil }[] = [
  { re: /nettoyage|d[ée]sinfection/i, sujet: 'nettoyage' },
  { re: /allerg[eè]n/i, sujet: 'allergenes' },
  { re: /tra[cç]abilit|[ée]tiquetage/i, sujet: 'tracabilite' },
  { re: /\bpms\b|plan de ma[iî]trise/i, sujet: 'pms' },
  { re: /hygi[eè]ne|haccp|alimentaire/i, sujet: 'hygiene' },
  { re: /duerp|document unique/i, sujet: 'duerp' },
  { re: /\bsst\b|sauveteur|secouris/i, sujet: 'sst' },
  { re: /incendie/i, sujet: 'incendie' },
  { re: /gestes|postures|\btms\b/i, sujet: 'gestes' },
  { re: /pr[ée]vention|risques|s[ée]curit/i, sujet: 'prevention' },
  { re: /rentabilit|co[uû]ts|gestion/i, sujet: 'gestion' },
  { re: /accueil|vente|commercial/i, sujet: 'vente' },
  { re: /manag|encadr|[ée]quipe/i, sujet: 'management' },
]
const SUJET_PAR_THEME: Record<ThemeRecueil, SujetRecueil> = { hygiene: 'hygiene', prevention: 'prevention', management: 'management', metier: 'metier' }

export function sujetDe(intitule: string, theme: ThemeRecueil): SujetRecueil {
  return SUJETS.find((s) => s.re.test(intitule))?.sujet || SUJET_PAR_THEME[theme]
}

function risqueDe(intitule: string): keyof typeof TEXTES.pv_risques {
  if (/duerp|document unique/i.test(intitule)) return 'duerp'
  if (/\bsst\b|sauveteur|secouris/i.test(intitule)) return 'sst'
  if (/incendie/i.test(intitule)) return 'incendie'
  if (/gestes|postures|\btms\b/i.test(intitule)) return 'gestes'
  return 'general'
}

// ── Les faits, écrits comme à la main ────────────────────────────────────

const SIGLES = ['haccp', 'pms', 'duerp', 'sst', 'caces', 'bph', 'tms', 'epi', 'ia', 'crm', 'hcr', 'opco', 'rh', 'ddpp', 'cap', 'bp', 'ssiap']
/** « HYGIÈNE ALIMENTAIRE ET PRÉVENTION DES RISQUES » devient « Hygiène alimentaire et prévention des risques » (sigles gardés) */
export function intituleLisible(v: string): string {
  const t = net(v)
  if (!t || t !== t.toUpperCase()) return t
  const bas = t.toLowerCase().replace(/\b[\p{L}]+\b/gu, (m) => (SIGLES.includes(m.normalize('NFD').replace(/\p{M}/gu, '')) ? m.toUpperCase() : m))
  return bas.charAt(0).toUpperCase() + bas.slice(1)
}

/** Activité du client, comme on la dirait : « restaurant rapide », « boulangerie » ; rien si elle ne dit rien d'utile */
function activiteDe(secteur: string): string {
  const s = secteur.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (!s) return ''
  if (/restauration de type rapide|restauration rapide/.test(s)) return 'restaurant rapide'
  if (/restauration traditionnelle/.test(s)) return 'restaurant'
  if (/boulangerie/.test(s)) return 'boulangerie'
  if (/patisserie/.test(s)) return 'pâtisserie'
  if (/viande|boucherie|charcuterie/.test(s)) return 'boucherie'
  if (/debits? de boissons/.test(s)) return 'bar'
  if (/superette|alimentation generale/.test(s)) return 'supérette'
  if (/traiteur/.test(s)) return 'traiteur'
  if (/hotel/.test(s)) return 'hôtel'
  if (/sieges? sociaux|formation|location|conseil|holding/.test(s)) return ''
  return secteur.length <= 30 ? secteur.charAt(0).toLowerCase() + secteur.slice(1) : ''
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** « les 16 et 17 novembre », « le 16 novembre », « du 30 novembre au 2 décembre » ; l'année seulement si ce n'est pas celle en cours */
export function datesLisibles(debut?: string | null, fin?: string | null, anneeCourante = new Date().getFullYear()): string {
  const lire = (d?: string | null) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '')
    return m ? { a: Number(m[1]), m: Number(m[2]) - 1, j: Number(m[3]), t: Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) } : null
  }
  const d = lire(debut)
  const f = lire(fin) || d
  if (!d || !f) return 'à des dates à confirmer'
  const an = (x: { a: number }) => (x.a !== anneeCourante ? ` ${x.a}` : '')
  const jour = (x: { j: number }) => (x.j === 1 ? '1er' : String(x.j))
  if (f.t <= d.t) return `le ${jour(d)} ${MOIS[d.m]}${an(d)}`
  if (d.a === f.a && d.m === f.m) return (f.t - d.t === 86400000 ? `les ${jour(d)} et ${jour(f)} ` : `du ${jour(d)} au ${jour(f)} `) + `${MOIS[f.m]}${an(f)}`
  return `du ${jour(d)} ${MOIS[d.m]}${d.a !== f.a ? an(d) : ''} au ${jour(f)} ${MOIS[f.m]}${an(f)}`
}

const heureCourte = (h?: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || '')
  return m ? `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}` : ''
}
function horairesDe(s: FaitsRecueil['session']): string {
  const j = (s.horaires_jours || []).find((x) => x && (x.matin_debut || x.aprem_debut))
  if (!j) return 'selon le programme'
  const matin = j.matin_debut && j.matin_fin ? `${heureCourte(j.matin_debut)}-${heureCourte(j.matin_fin)}` : ''
  const aprem = j.aprem_debut && j.aprem_fin ? `${heureCourte(j.aprem_debut)}-${heureCourte(j.aprem_fin)}` : ''
  return [matin, aprem].filter(Boolean).join(' / ') || 'selon le programme'
}

/** « une personne », « 3 personnes » : en chiffres, comme les postes qui suivent */
const personnes = (n: number) => (n === 1 ? 'une personne' : `${n} personnes`)

/** Pluriel simple d'un poste : « employé polyvalent » devient « employés polyvalents », « agent de service » devient « agents de service » */
function pluriel(poste: string): string {
  const mots = poste.split(' ')
  const fin = mots.findIndex((m) => /^(de|du|des|d’|d'|en|à)$/i.test(m) || /^d[’']/i.test(m))
  return mots.map((m, i) => ((fin === -1 || i < fin) && !/[sxz]$/i.test(m) && /\p{L}$/u.test(m) ? `${m}s` : m)).join(' ')
}
/** « 3 personnes : 2 employés polyvalents, 1 gérant » */
function participantsDe(inscrits: FaitsRecueil['inscrits']): string {
  const groupes = new Map<string, { libelle: string; n: number }>()
  for (const i of inscrits) {
    const libelle = net(i.poste).toLowerCase()
    if (!libelle) continue
    const cle = libelle.normalize('NFD').replace(/\p{M}/gu, '')
    const g = groupes.get(cle)
    if (g) g.n++; else groupes.set(cle, { libelle, n: 1 })
  }
  const total = inscrits.length
  const postes = Array.from(groupes.values()).sort((a, b) => b.n - a.n).map((g) => `${g.n} ${g.n > 1 ? pluriel(g.libelle) : g.libelle}`)
  const connus = Array.from(groupes.values()).reduce((s, g) => s + g.n, 0)
  if (!postes.length) return personnes(total)
  return connus === total ? `${personnes(total)} : ${postes.join(', ')}` : `${personnes(total)}, dont ${postes.join(', ')}`
}

/** Objectifs de la formation, une ligne chacun (liste ou texte libre) */
export function objectifsDe(brut: unknown): string[] {
  let o: unknown = brut
  if (typeof o === 'string') { try { o = JSON.parse(o) } catch { /* texte libre */ } }
  const lignes = Array.isArray(o) ? o.map(net) : String(o ?? '').split(/\n+/).map(net)
  // Sans les phrases d'introduction du programme (« Objectifs : », « À l'issue de la formation, les participants seront capables de »)
  return lignes.map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((l) => l && !/^objectifs?\b.{0,40}:?$/i.test(l) && !/^(à|a) l['’]issue|^au terme|^en fin de formation|capables? de\s*:?$|:$/i.test(l))
}

function prerequisDe(brut: unknown): string {
  const t = net(brut)
  if (!t || /^aucun/i.test(t)) return 'aucun prérequis'
  const premiere = sansPoint(t.split(/(?<=[.!?])\s/)[0])
  return premiere.charAt(0).toLowerCase() + premiere.slice(1)
}

/** Les valeurs des balises, pour un dossier */
export function balisesDe(f: FaitsRecueil, besoin: string): Record<string, string> {
  const client = net(f.client?.nom_commercial || f.client?.raison_sociale) || 'le client'
  const villeBrute = net(f.session.ville || f.client?.ville)
  const ville = villeBrute ? libelleVille(villeBrute) : ''
  const activite = activiteDe(net(f.client?.secteur_activite))
  const reseau = net(f.client?.franchise)
  const intitule = intituleLisible(net(f.formation?.intitule || f.session.intitule)) || 'la formation prévue'
  const intra = f.session.type_session === 'intra'
  const distance = /distan|visio|ligne/i.test(net(f.session.modalite))
  const duree = Number(f.formation?.duree_heures)
  const handicaps = f.inscrits.filter((i) => i.situation_handicap).length
  const objectifs = objectifsDe(f.formation?.objectifs_pedagogiques)
  return {
    client,
    qui: `${client}${activite ? `, ${activite}` : ''}${ville ? ` à ${ville}` : ''}${reseau ? ` (réseau ${reseau})` : ''}`,
    besoin,
    formation: intitule,
    dates: datesLisibles(f.session.date_debut, f.session.date_fin),
    duree: Number.isFinite(duree) && duree > 0 ? `${duree} h` : 'la durée du programme',
    horaires: horairesDe(f.session),
    lieu: distance ? 'à distance' : intra ? (ville ? `dans l’établissement, à ${ville}` : 'dans l’établissement') : ville ? `à ${ville}` : 'dans nos locaux',
    modalite: distance ? 'à distance' : intra ? 'en intra' : f.session.type_session === 'inter' ? 'en inter-entreprises' : 'en présentiel',
    participants: participantsDe(f.inscrits),
    n: String(f.inscrits.length),
    prerequis: prerequisDe(f.formation?.prerequis),
    nb_handicap: personnes(handicaps || 1),
    objectifs: objectifs.length ? objectifs.slice(0, 6).map((o) => `- ${sansPoint(o)}`).join('\n') : `- Mettre en pratique au poste de travail ce qui est vu en formation`,
  }
}

/** Remplace les balises ; une balise inconnue resterait visible (les tests vérifient qu'il n'y en a aucune) */
export const remplir = (modele: string, balises: Record<string, string>) => modele.replace(/\{([a-z_]+)\}/g, (m, cle) => balises[cle] ?? m)

/** Réponses automatiques, pour les questions connues du modèle (les autres restent vides). */
export function reponsesAutomatiques(f: FaitsRecueil, theme: ThemeRecueil, questions: string[]): Record<string, string> {
  const graine = net(f.session.id) || net(f.session.reference) || 'recueil'
  const t = <K>(liste: readonly K[], champ: string) => tirer(liste, `${graine}:${champ}`)
  const intitule = net(f.formation?.intitule || f.session.intitule)
  const sujet = sujetDe(intitule, theme)
  const besoin = t(TEXTES.besoins[sujet], 'besoin')
  const b = balisesDe(f, besoin)
  const r: Record<string, string> = {
    contexte: remplir(t(TEXTES.contexte, 'contexte'), b),
    participants: remplir(f.inscrits.length ? t(TEXTES.participants_avec, 'participants') : t(TEXTES.participants_sans, 'participants'), b),
    niveau: remplir(t(TEXTES.niveau, 'niveau'), b),
    objectifs: remplir(t(TEXTES.objectifs_intro, 'objectifs'), b),
    contraintes: remplir(t(TEXTES.contraintes, 'contraintes'), b),
    handicap: remplir(f.inscrits.some((i) => i.situation_handicap) ? t(TEXTES.handicap_signale, 'handicap') : t(TEXTES.handicap_aucun, 'handicap'), b),
    attentes: remplir(t(TEXTES.attentes[theme], 'attentes'), b),
    hy_process: remplir(t(TEXTES.hy_process, 'hy_process'), b),
    pv_risques: remplir(t(TEXTES.pv_risques[risqueDe(intitule)], 'pv_risques'), b),
    mg_equipe: remplir(t(TEXTES.mg_equipe, 'mg_equipe'), b),
    me_gestes: remplir(t(TEXTES.me_gestes, 'me_gestes'), b),
  }
  const reponses: Record<string, string> = {}
  for (const q of questions) if (r[q]) reponses[q] = r[q]
  return reponses
}

/** Clé où le recueil garde ce que le CRM a écrit lui-même (date, valeurs) : un texte JSON, comme les autres réponses */
export const CLE_AUTO = '_auto'

export interface TraceAuto { le: string; champs: Record<string, string> }

export function lireTraceAuto(reponses: Record<string, unknown> | null | undefined): TraceAuto | null {
  const brut = reponses?.[CLE_AUTO]
  if (typeof brut !== 'string') return null
  try {
    const t = JSON.parse(brut)
    return t && typeof t.le === 'string' && t.champs && typeof t.champs === 'object' ? t : null
  } catch { return null }
}

/**
 * Fusion avec un recueil existant : un champ vide reçoit la réponse
 * automatique ; un champ que le CRM avait écrit et que personne n'a modifié
 * suit les faits (inscrits, horaires…) ; un champ modifié à la main n'est
 * jamais touché. Renvoie les réponses fusionnées et ce qui a changé.
 */
export function fusionner(existantes: Record<string, string>, auto: Record<string, string>, aujourdhui: string): { reponses: Record<string, string>; modifies: string[] } {
  const trace = lireTraceAuto(existantes)
  const champs: Record<string, string> = { ...(trace?.champs || {}) }
  const reponses = { ...existantes }
  const modifies: string[] = []
  for (const [id, valeur] of Object.entries(auto)) {
    const actuel = String(existantes[id] ?? '').trim()
    const ecritParLeCrm = !!trace && trace.champs[id] !== undefined && actuel === String(trace.champs[id]).trim()
    if (!actuel || (ecritParLeCrm && actuel !== valeur.trim())) {
      reponses[id] = valeur
      champs[id] = valeur
      modifies.push(id)
    }
  }
  if (modifies.length) reponses[CLE_AUTO] = JSON.stringify({ le: trace?.le || aujourdhui, champs })
  return { reponses, modifies }
}
