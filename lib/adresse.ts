/**
 * Aide à la saisie des adresses françaises.
 *
 * Deux sources publiques, sans clé, interrogées par nos routes
 * /api/public/adresse et /api/public/communes (jamais depuis le navigateur :
 * la saisie d'un visiteur ne part pas chez un tiers, et un changement
 * d'adresse du service se règle à un seul endroit) :
 *   - le géocodage de la Géoplateforme (IGN), qui sert la Base Adresse
 *     Nationale depuis l'arrêt d'api-adresse.data.gouv.fr ;
 *   - l'API Découpage administratif (geo.api.gouv.fr) pour les communes d'un
 *     code postal.
 *
 * Ce module ne contient que des fonctions pures et les appels du navigateur
 * vers nos routes : il s'importe aussi bien d'un composant client que d'une
 * route serveur. Les champs eux-mêmes sont dans components/ui/AdresseFields.
 *
 * Règle d'usage : la suggestion aide, elle ne bloque jamais. Si le service ne
 * répond pas, tous les champs restent des champs de saisie ordinaires.
 */

export interface AdresseSuggestion {
  id: string
  /** Ligne de voie à écrire dans le champ adresse : « 6 bis Boulevard Berthelot » */
  adresse: string
  code_postal: string
  ville: string
  /** Nom du département, pour départager deux voies homonymes */
  departement: string
  code_departement: string
  code_insee: string
  type: 'numero' | 'voie' | 'lieu-dit'
  latitude: number | null
  longitude: number | null
}

export interface CommuneSuggestion {
  nom: string
  code_insee: string
  /** Tous les codes postaux de la commune (21 pour Paris, 1 pour la plupart) */
  codes_postaux: string[]
  departement: string
  code_departement: string
  population: number | null
}

/** Le service d'adresses ne répond pas : la saisie continue à la main. */
export class ServiceAdresseIndisponible extends Error {
  constructor() {
    super('Service d’adresses indisponible')
    this.name = 'ServiceAdresseIndisponible'
  }
}

export const LONGUEUR_MIN_ADRESSE = 3
export const LONGUEUR_MIN_VILLE = 2

// ─── Fonctions pures ────────────────────────────────────────────────────────

// Plage des signes diacritiques combinants, construite sans séquence
// d'échappement dans le source (elles ne survivent pas à tous les outils).
const DIACRITIQUES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g')

/** Un code postal français complet : cinq chiffres. */
export function estCodePostal(valeur: string | null | undefined): boolean {
  return /^\d{5}$/.test(nettoyerCodePostal(valeur))
}

/** « 34 000 » → « 34000 ». Ne touche pas à un code étranger. */
export function nettoyerCodePostal(valeur: string | null | undefined): string {
  return String(valeur ?? '').replace(/\s+/g, '').trim()
}

/** Texte ramené à ses lettres et chiffres : sans casse, sans accents, sans ponctuation. */
export function cleTexte(texte: string | null | undefined): string {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(DIACRITIQUES, '')
    .toLowerCase()
    // Ces deux lettres ne se décomposent pas : « Vandœuvre » doit valoir « Vandoeuvre »
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Clé de comparaison de deux noms de commune : « St » lu « Saint », mention
 * CEDEX et arrondissement écartés. « ST-ETIENNE CEDEX 2 » et « Saint-Étienne »
 * donnent la même clé, comme « LYON 7EME » et « Lyon ».
 */
export function cleVille(nom: string | null | undefined): string {
  return cleTexte(nom)
    .replace(/\bcedex\b.*$/, '')
    .trim()
    .replace(/\bste\b/g, 'sainte')
    .replace(/\bst\b/g, 'saint')
    // Seules Paris, Lyon et Marseille ont des arrondissements : ailleurs, un
    // nombre en fin de nom fait partie de ce que l'utilisateur a écrit.
    .replace(/^(paris|lyon|marseille) \d{1,2} ?(?:er|e|eme|ieme)?(?: arrondissement)?$/, '$1')
}

export function memeVille(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = cleVille(a)
  return ka !== '' && ka === cleVille(b)
}

/** « 6bis » → « 6 bis », « 12b » → « 12 B » (usage postal français). */
export function formaterNumeroVoie(numero: string | null | undefined): string {
  const brut = String(numero ?? '').trim()
  const m = /^(\d+)\s*([a-zA-Z]+)$/.exec(brut)
  if (!m) return brut
  const indice = m[2].length === 1 ? m[2].toUpperCase() : m[2].toLowerCase()
  return `${m[1]} ${indice}`
}

/** Adresse sur une ligne, pour un champ unique : « 6 bis Boulevard Berthelot, 34000 Montpellier ». */
export function adresseSurUneLigne(s: Pick<AdresseSuggestion, 'adresse' | 'code_postal' | 'ville'>): string {
  const commune = [s.code_postal, s.ville].filter(Boolean).join(' ')
  return [s.adresse, commune].filter(Boolean).join(', ')
}

/** La requête contient-elle déjà un code postal ? (« 12 rue X 69002 Lyon ») */
export function codePostalDansTexte(texte: string): string | null {
  const m = /(?:^|\D)(\d{5})(?:\D|$)/.exec(texte)
  return m ? m[1] : null
}

/**
 * Prépare un nom de commune pour la recherche : « st etienne cedex 2 » →
 * « saint etienne », « Lyon 7e » → « Lyon ». « St » seul reste tel quel : c'est
 * peut-être le début de Strasbourg.
 */
export function requeteCommune(nom: string): string {
  return nom
    .replace(/\bcedex\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bste[.\s-]+(?=\S)/gi, 'sainte ')
    .replace(/\bst[.\s-]+(?=\S)/gi, 'saint ')
    .replace(/^(paris|lyon|marseille)\s+\d{1,2}\s*(?:er|e|eme|ème|ieme|ième)?(?:\s+arrondissement)?$/i, '$1')
}

const MOTS_DE_VOIE = /\b(rue|avenue|av|bd|boulevard|chemin|impasse|allee|place|route|quai|cours|square|faubourg|passage|voie|lotissement|residence|zone|za|zi|zac|hameau|cite|esplanade|parvis|sentier|traverse|villa)\b/

/**
 * Un texte libre a-t-il l'air d'une adresse ? Un chiffre ou un mot de voie.
 * Sert aux champs de lieu (« Dans les locaux du client ») pour ne pas proposer
 * une « Impasse des Locaux » à qui n'écrit pas une adresse.
 */
export function ressembleAUneAdresse(texte: string): boolean {
  return /\d/.test(texte) || MOTS_DE_VOIE.test(cleTexte(texte))
}

// Abréviations de voie qui ne sont pas le début du mot entier
const ABREVIATIONS_DE_VOIE: Record<string, string> = {
  bd: 'boulevard', bld: 'boulevard', blvd: 'boulevard', rte: 'route', crs: 'cours', fg: 'faubourg', fbg: 'faubourg', pce: 'place',
}

/**
 * La voie proposée, précédée du numéro que l'utilisateur avait tapé. La Base
 * Adresse Nationale ne connaît pas tous les numéros : elle répond alors par la
 * voie seule, et le « 12 ter » saisi disparaîtrait du champ.
 *
 * Le numéro n'est gardé que si le mot qui le suit dans la saisie commence la
 * voie proposée (« 12 rue de la p » pour « Rue de la Paix ») : « 8 mai 1945 »
 * n'est pas un numéro, et un numéro tapé pour une autre voie ne se reporte pas.
 */
export function voieAvecNumeroSaisi(saisie: string, voie: string): string {
  const m = /^(\d{1,4})\s*(bis|ter|quater|[a-z])?[\s,]+(\S+)/i.exec(saisie.trim())
  if (!m) return voie
  const suivant = cleTexte(m[3])
  const attendu = ABREVIATIONS_DE_VOIE[suivant] || suivant
  const premierMot = cleTexte(voie).split(' ')[0] || ''
  if (!attendu || !premierMot.startsWith(attendu)) return voie
  return `${formaterNumeroVoie(`${m[1]}${m[2] || ''}`)} ${voie}`
}

/** Une réponse du géocodage (GeoJSON de la Base Adresse Nationale) → une suggestion. */
export function suggestionDepuisBan(feature: any): AdresseSuggestion | null {
  const p = feature?.properties
  if (!p || !p.postcode || !p.city) return null
  let type: AdresseSuggestion['type']
  if (p.type === 'housenumber') type = 'numero'
  else if (p.type === 'street') type = 'voie'
  else if (p.type === 'locality') type = 'lieu-dit'
  else return null // une commune entière n'est pas une adresse

  const voie = String(p.street || p.name || '').trim()
  const adresse = type === 'numero' && p.housenumber
    ? `${formaterNumeroVoie(p.housenumber)} ${voie}`.trim()
    : String(p.name || voie).trim()
  if (!adresse) return null

  const contexte = String(p.context || '').split(',').map((x: string) => x.trim())
  const coords = feature?.geometry?.coordinates
  return {
    id: String(p.id || `${adresse}|${p.postcode}|${p.city}`),
    adresse,
    code_postal: String(p.postcode),
    ville: String(p.city),
    departement: contexte[1] || '',
    // Outre-mer : depcode vaut « 97 » pour tous, le vrai code (974) est en tête du contexte
    code_departement: String(contexte[0] || p.depcode || ''),
    code_insee: String(p.citycode || ''),
    type,
    longitude: Array.isArray(coords) && typeof coords[0] === 'number' ? coords[0] : null,
    latitude: Array.isArray(coords) && typeof coords[1] === 'number' ? coords[1] : null,
  }
}

/** Une ligne de l'API Découpage administratif → une commune. */
export function communeDepuisGeo(ligne: any): CommuneSuggestion | null {
  if (!ligne?.nom) return null
  return {
    nom: String(ligne.nom),
    code_insee: String(ligne.code || ''),
    codes_postaux: Array.isArray(ligne.codesPostaux) ? ligne.codesPostaux.map(String).sort() : [],
    departement: String(ligne.departement?.nom || ''),
    code_departement: String(ligne.codeDepartement || ligne.departement?.code || ''),
    population: typeof ligne.population === 'number' ? ligne.population : null,
  }
}

/**
 * Réunit les adresses trouvées dans le code postal déjà saisi (`locales`) et
 * celles trouvées partout (`generales`). Le code postal du formulaire donne la
 * priorité, sauf quand le texte tapé correspond nettement mieux ailleurs :
 * quelqu'un qui écrit « … Lyon » dans une fiche de Vienne change d'adresse.
 */
export function fusionnerSuggestions(
  locales: Array<{ s: AdresseSuggestion; score: number }>,
  generales: Array<{ s: AdresseSuggestion; score: number }>,
  limite: number,
): AdresseSuggestion[] {
  const meilleur = (l: Array<{ score: number }>) => l.reduce((m, x) => Math.max(m, x.score), 0)
  const ailleursNettementMieux = meilleur(generales) - meilleur(locales) > 0.25
  const [premiers, seconds] = ailleursNettementMieux ? [generales, locales] : [locales, generales]
  const vus = new Set<string>()
  const sortie: AdresseSuggestion[] = []
  // Le premier groupe occupe au plus les deux tiers de la liste : l'autre
  // lecture reste visible quand elle existe.
  const partPremiers = seconds.length ? Math.max(1, Math.ceil((limite * 2) / 3)) : limite
  for (const [liste, plafond] of [[premiers, partPremiers], [seconds, limite], [premiers, limite]] as const) {
    for (const { s } of liste) {
      if (sortie.length >= plafond) break
      const cle = cleSuggestion(s)
      if (vus.has(cle)) continue
      vus.add(cle)
      sortie.push(s)
    }
  }
  return sortie.slice(0, limite)
}

/** Deux réponses qui s'afficheraient à l'identique n'en font qu'une. */
function cleSuggestion(s: AdresseSuggestion): string {
  return `${cleTexte(s.adresse)}|${s.code_postal}|${cleTexte(s.ville)}`
}

export function dedoublonnerSuggestions(liste: AdresseSuggestion[], limite: number): AdresseSuggestion[] {
  const vus = new Set<string>()
  const sortie: AdresseSuggestion[] = []
  for (const s of liste) {
    const cle = cleSuggestion(s)
    if (vus.has(cle)) continue
    vus.add(cle)
    sortie.push(s)
    if (sortie.length >= limite) break
  }
  return sortie
}

// ─── Appels du navigateur vers nos routes ───────────────────────────────────

// Réponses déjà reçues pendant la visite : revenir sur un texte déjà tapé
// (correction d'une faute, effacement) ne refait pas la requête.
const memoire = new Map<string, unknown>()
const TAILLE_MEMOIRE = 200

async function lire<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (memoire.has(url)) return memoire.get(url) as T
  let reponse: Response
  try {
    reponse = await fetch(url, { signal, headers: { accept: 'application/json' } })
  } catch (e) {
    if ((e as any)?.name === 'AbortError') throw e
    throw new ServiceAdresseIndisponible()
  }
  if (!reponse.ok) throw new ServiceAdresseIndisponible()
  const donnees = (await reponse.json()) as T
  if (memoire.size >= TAILLE_MEMOIRE) memoire.delete(memoire.keys().next().value as string)
  memoire.set(url, donnees)
  return donnees
}

/** Adresses correspondant au texte tapé. `codePostal` : celui déjà saisi dans le formulaire, qui donne la priorité. */
export async function rechercherAdresses(
  texte: string,
  options: { codePostal?: string; limite?: number; signal?: AbortSignal } = {},
): Promise<AdresseSuggestion[]> {
  const q = texte.replace(/\s+/g, ' ').trim()
  if (q.length < LONGUEUR_MIN_ADRESSE) return []
  const p = new URLSearchParams({ q })
  if (options.codePostal && estCodePostal(options.codePostal)) p.set('cp', nettoyerCodePostal(options.codePostal))
  if (options.limite) p.set('limit', String(options.limite))
  const d = await lire<{ suggestions?: AdresseSuggestion[] }>(`/api/public/adresse?${p}`, options.signal)
  return Array.isArray(d.suggestions) ? d.suggestions : []
}

/** Communes d'un code postal, la plus peuplée d'abord. Liste vide pour un CEDEX ou un code inconnu. */
export async function communesDuCodePostal(codePostal: string, signal?: AbortSignal): Promise<CommuneSuggestion[]> {
  const cp = nettoyerCodePostal(codePostal)
  if (!estCodePostal(cp)) return []
  const d = await lire<{ communes?: CommuneSuggestion[] }>(`/api/public/communes?cp=${cp}`, signal)
  return Array.isArray(d.communes) ? d.communes : []
}

/** Communes dont le nom commence comme le texte tapé. */
export async function rechercherCommunes(nom: string, signal?: AbortSignal): Promise<CommuneSuggestion[]> {
  const q = requeteCommune(nom)
  if (q.length < LONGUEUR_MIN_VILLE) return []
  const d = await lire<{ communes?: CommuneSuggestion[] }>(`/api/public/communes?${new URLSearchParams({ nom: q })}`, signal)
  return Array.isArray(d.communes) ? d.communes : []
}
