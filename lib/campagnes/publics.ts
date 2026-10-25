import type { EtapeLead, OrigineLead } from '@/lib/leads-entrants'

/**
 * Publics et filtres d'une campagne, communs à l'écran et au serveur (rien
 * qui touche à la base) :
 * - publics : prospects (leads), clients (tous, indépendants ou franchisés
 *   d'un ou plusieurs réseaux), têtes de réseau (référent de la franchise et
 *   comptes actifs du portail franchise), apporteurs d'affaires ;
 * - filtres des prospects et des clients : villes ou départements, secteurs
 *   d'activité, formations suivies (ou jamais suivies, ou demandées par un
 *   prospect).
 * Le calcul lui-même est dans lib/campagnes/audience.ts.
 */

/** Durée de conservation des prospects annoncée sur le site : jamais d'envoi au-delà */
export const JOURS_CONSERVATION = 3 * 365

export type PerimetreClients = 'tous' | 'independants' | 'franchises'
export type ModeFormation = 'suivie' | 'jamais'
export type PeriodeFormation = 'toutes' | 'moins_6_mois' | 'moins_1_an' | 'plus_1_an' | 'plus_2_ans'
/** Ce que désigne campagne_envois.personne_id (migration 170 pour les quatre derniers) */
export type TypePersonne = 'lead' | 'contact' | 'client' | 'franchise' | 'utilisateur' | 'apporteur'
export type PublicAudience = 'prospects' | 'clients' | 'reseaux' | 'apporteurs'

export interface FiltresAudience {
  prospects: { actif: boolean; origines: OrigineLead[]; etapes: EtapeLead[]; depuisJours: number }
  clients: {
    actif: boolean
    perimetre: PerimetreClients
    /** Réseaux retenus quand le périmètre est « franchisés » (vide : tous les réseaux) */
    franchiseIds: string[]
    /** Un seul message par établissement : le contact principal, sinon le référent formation… */
    unParEtablissement: boolean
  }
  /** Têtes de réseau (vide : tous les réseaux actifs) */
  reseaux: { actif: boolean; franchiseIds: string[] }
  apporteurs: { actif: boolean }
  /** Lieu : clés de ville (cleVille) ou départements ; l'un ou l'autre suffit. Prospects et clients seulement */
  villes: string[]
  departements: string[]
  /** Secteurs d'activité (cleTexte). Prospects et clients seulement */
  secteurs: string[]
  /**
   * Formations (identifiants ; une formation et ses versions) : clients déjà
   * formés (sur la période) ou jamais formés ; pour un prospect, formation
   * demandée ou non.
   */
  formations: { ids: string[]; mode: ModeFormation; periode: PeriodeFormation }
}

export const PERIMETRES: { id: PerimetreClients; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'independants', label: 'Indépendants' },
  { id: 'franchises', label: 'Franchisés' },
]

export const PERIODES_FORMATION: { id: PeriodeFormation; label: string }[] = [
  { id: 'toutes', label: 'à n’importe quelle date' },
  { id: 'moins_6_mois', label: 'ces 6 derniers mois' },
  { id: 'moins_1_an', label: 'ces 12 derniers mois' },
  { id: 'plus_1_an', label: 'il y a plus d’un an, rien depuis' },
  { id: 'plus_2_ans', label: 'il y a plus de 2 ans, rien depuis' },
]

/** Les demandes entrantes : site, Meta, Google Ads, apporteurs (pas les anciens leads de salons ou de phoning) */
export const ORIGINES_ENTRANTES: OrigineLead[] = ['site', 'meta', 'google_ads', 'apporteur']

/** Audience d'une nouvelle campagne : les demandes entrantes des 3 dernières années */
export function audienceParDefaut(): FiltresAudience {
  return {
    prospects: { actif: true, origines: [...ORIGINES_ENTRANTES], etapes: [], depuisJours: JOURS_CONSERVATION },
    clients: { actif: false, perimetre: 'tous', franchiseIds: [], unParEtablissement: true },
    reseaux: { actif: false, franchiseIds: [] },
    apporteurs: { actif: false },
    villes: [],
    departements: [],
    secteurs: [],
    formations: { ids: [], mode: 'suivie', periode: 'toutes' },
  }
}

// ── Comparaison des textes saisis ────────────────────────────────────────

/** Clé de comparaison d'un texte : sans accents, en minuscules, espaces simples */
export const cleTexte = (v: unknown): string => String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Clé d'un intitulé de formation : « Hygiène alimentaire & prévention » et « HYGIÈNE ALIMENTAIRE ET PRÉVENTION » se rejoignent */
export const cleFormation = (v: unknown): string => cleTexte(v).replace(/&/g, ' et ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Clé d'une ville : « Saint-Jean-de-Védas », « ST JEAN DE VEDAS » ou « Montpellier Cedex 2 » se rejoignent */
export function cleVille(v: unknown): string {
  return cleTexte(v)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-'’.,/]/g, ' ')
    .replace(/\bcedex\b.*$/, '')
    .replace(/\b\d{5}\b/g, ' ')
    // Arrondissements : « Paris 15e », « Lyon 3e arrondissement »
    .replace(/\b\d{1,2}\s*(er|e|eme)?\s*(arrondissement|arr)?\s*$/, '')
    .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte')
    .replace(/\s+/g, ' ').trim()
}

const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'et', 'aux', 'au', 'lez'])
/** Libellé lisible d'une ville écrite en capitales : « SAINT JEAN DE VEDAS » devient « Saint Jean de Vedas » */
export function libelleVille(v: string): string {
  const t = String(v || '').replace(/\s+/g, ' ').trim()
  if (t !== t.toUpperCase()) return t
  return t.toLowerCase().split(/([\s-])/).map((m, i) => (/^[\s-]$/.test(m) || (i > 0 && PETITS_MOTS.has(m)) ? m : m.charAt(0).toUpperCase() + m.slice(1))).join('')
}

/** Noms des départements, pour l'écran (« 34 · Hérault ») */
export const NOMS_DEPARTEMENTS: Record<string, string> = {
  '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes',
  '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube', '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône',
  '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze',
  '2A': 'Corse-du-Sud', '2B': 'Haute-Corse', '21': 'Côte-d’Or', '22': 'Côtes-d’Armor', '23': 'Creuse', '24': 'Dordogne',
  '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '30': 'Gard', '31': 'Haute-Garonne',
  '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère',
  '39': 'Jura', '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret',
  '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire', '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne',
  '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord',
  '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées',
  '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône', '71': 'Saône-et-Loire',
  '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne',
  '78': 'Yvelines', '79': 'Deux-Sèvres', '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse',
  '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Territoire de Belfort',
  '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': 'Val-d’Oise',
  '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte',
}

/** Département d'un code postal : 2 chiffres, 3 pour l'outre-mer, 2A ou 2B pour la Corse. */
export function departement(cp: string | null | undefined): string | null {
  const c = String(cp || '').replace(/\s/g, '')
  if (!/^\d{5}$/.test(c)) return null
  if (c.startsWith('97')) return c.slice(0, 3)
  if (c.startsWith('20')) return Number(c) < 20200 ? '2A' : '2B'
  return c.slice(0, 2)
}

// ── Filtres reçus du navigateur ──────────────────────────────────────────

const ORIGINES_VALIDES: OrigineLead[] = ['site', 'meta', 'google_ads', 'apporteur', 'ancien']
const ETAPES_VALIDES: EtapeLead[] = ['a_traiter', 'contacte', 'qualifie', 'gagne', 'perdu']
const PERIODES_VALIDES = PERIODES_FORMATION.map((p) => p.id)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEPARTEMENT = /^(\d{2}|2A|2B|97\d)$/
const normDepartement = (d: unknown) => { const x = String(d ?? '').trim().toUpperCase(); return /^\d$/.test(x) ? `0${x}` : x }

/** Départements saisis qui ne sont pas reconnus (pour le dire, au lieu de les ignorer et d'élargir l'audience) */
export function departementsInconnus(brut: any): string[] {
  const liste = Array.isArray(brut?.departements) ? brut.departements : Array.isArray(brut?.contacts?.departements) ? brut.contacts.departements : []
  return liste.map(normDepartement).filter((d: string) => d && !DEPARTEMENT.test(d))
}

/**
 * Filtres reçus du navigateur ou lus en base : on ne garde que des valeurs
 * connues. Reprend aussi le premier format (24/10/2026 : { leads, contacts }).
 */
export function nettoyerFiltres(brut: any): FiltresAudience {
  const b = brut && typeof brut === 'object' ? brut : {}
  const ancien = !b.prospects && !b.clients && !b.reseaux && !b.apporteurs && (b.leads || b.contacts)
  const p = ancien ? b.leads : b.prospects
  const c = ancien ? b.contacts : b.clients
  const liste = <T extends string>(v: unknown, valides: readonly T[]) => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is T => valides.includes(x as T)))) : [])
  const ids = (v: unknown, max: number) => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && UUID.test(x)))).slice(0, max) : [])
  const cles = (v: unknown, cle: (x: unknown) => string, max: number) => (Array.isArray(v)
    ? Array.from(new Set(v.filter((x) => typeof x === 'string' && x.length <= 200).map(cle).filter(Boolean))).slice(0, max)
    : [])
  const jours = Number(p?.depuisJours)
  const reseauxClients = ids(ancien ? (typeof c?.franchiseId === 'string' ? [c.franchiseId] : []) : c?.franchiseIds, 50)
  const perimetre: PerimetreClients = ancien
    ? (reseauxClients.length ? 'franchises' : 'tous')
    : (['tous', 'independants', 'franchises'].includes(c?.perimetre) ? c.perimetre : 'tous')
  // Ancien format : le département ne filtrait que les contacts des clients
  const departements = ancien ? (c?.actif === true && Array.isArray(c?.departements) ? c.departements : []) : (Array.isArray(b.departements) ? b.departements : [])
  return {
    prospects: {
      actif: p?.actif === true,
      origines: liste(p?.origines, ORIGINES_VALIDES),
      etapes: liste(p?.etapes, ETAPES_VALIDES),
      // 3 ans au plus, et par défaut (durée de conservation des prospects)
      depuisJours: Number.isFinite(jours) && jours > 0 ? Math.min(Math.round(jours), JOURS_CONSERVATION) : JOURS_CONSERVATION,
    },
    clients: {
      actif: c?.actif === true,
      perimetre,
      franchiseIds: perimetre === 'franchises' ? reseauxClients : [],
      // Ancien format : « contact principal seulement » ; sinon un par établissement, par défaut
      unParEtablissement: ancien ? c?.principalSeulement === true : c?.unParEtablissement !== false,
    },
    reseaux: { actif: b.reseaux?.actif === true, franchiseIds: ids(b.reseaux?.franchiseIds, 50) },
    apporteurs: { actif: b.apporteurs?.actif === true },
    villes: cles(b.villes, cleVille, 1000),
    departements: Array.from(new Set(departements.map(normDepartement).filter((d: string) => DEPARTEMENT.test(d)))) as string[],
    secteurs: cles(b.secteurs, cleTexte, 500),
    formations: {
      ids: ids(b.formations?.ids, 1000),
      mode: b.formations?.mode === 'jamais' ? 'jamais' : 'suivie',
      periode: PERIODES_VALIDES.includes(b.formations?.periode) ? b.formations.periode : 'toutes',
    },
  }
}

/** Au moins un public choisi */
export const aUnPublic = (f: FiltresAudience) => f.prospects.actif || f.clients.actif || f.reseaux.actif || f.apporteurs.actif
