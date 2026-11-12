/**
 * Connecteur Claude : ce qui ne sort jamais du CRM, et ce qui sort masqué.
 *
 * Demande de Brahim (12/11/2026) : Claude lit « absolument tout » le CRM, en
 * lecture seule. Restent dehors les secrets d'accès, qui ouvrent des portes au
 * lieu de renseigner : jetons de portail et de signature, clés et empreintes,
 * mots de passe et comptes OPCO chiffrés, images de signature, adresses IP et
 * navigateurs. Le numéro de sécurité sociale et les IBAN sortent masqués, y
 * compris saisis dans un texte libre.
 */

/**
 * Tables dont le contenu même est un secret d'accès. dendreo_webhook_events
 * est un journal technique brut (déjà reporté dans le CRM) dont les liens
 * publics Dendreo ouvrent des documents signés sans connexion.
 */
export const TABLES_EXCLUES = new Set(['api_keys', 'portal_access_tokens', 'invitations', 'dendreo_webhook_events'])

/** Colonnes et clés JSON jamais transmises */
const SECRET = new RegExp([
  '(^|_)(token|tokens|jeton|jetons|secret|secrets|password|passwords|mot_de_passe|hash|empreinte|empreintes|user_agent|ip_address|ip|chiffre)($|_)',
  // Clés et identifiants de connexion, sous leurs noms courants
  '(^|_)(key|keys|apikey|cle|clef|cles|otp|pin|cvv|cvc|bearer|authorization|cookie|cookies|credential|credentials)($|_)',
  // Images de signature : signature_data, signature_client_signature_data, signature_stagiaire_data, ft_sig_data…
  'signature(_[a-z]+)*_data',
  '(^|_)sig_(data|agent|ip|trace)($|_)',
  'cle_verification',
  'tampon_signature_url',
  'signature_document_path',
].join('|'), 'i')
/** Noms qui ressemblent à un secret sans en être un : identifiant d'import Dendreo, étape clé d'un déroulé */
const PAS_SECRET = new Set(['dendreo_key', 'etape_cle'])
export const estSecrete = (nom: string) => !PAS_SECRET.has(nom) && SECRET.test(nom)

const NIR = /numero_securite_sociale|(^|_)nir($|_)/i
const IBAN = /(^|_)iban($|_)/i
/** Colonne dont la valeur sort masquée : ni filtre de valeur, ni tri, ni calcul dessus */
export const estMasquee = (nom: string) => NIR.test(nom) || IBAN.test(nom)

const LONGUEUR_MAX = 3000
const DATA_URI_SEUL = /^\s*data:[^,\s]{1,200},/i
const DATA_URI = /data:[\w/+.-]+(;[\w=.-]+)*;base64,[A-Za-z0-9+/=\r\n]+/gi
const SVG_EN_LIGNE = /data:image\/svg\+xml[^"'\s)]*/gi
const BASE64_LONG = /^[A-Za-z0-9+/=\r\n]{400,}$/
// Jeton hexadécimal de 32 caractères et plus, même collé à un « _ » ou à une lettre
const JETON_HEX = /(?<![0-9a-f])[a-f0-9]{32,}(?![0-9a-f])/gi
// Jeton JWT, par exemple celui d'un lien de téléchargement signé du stockage
const JETON_JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
// Pages publiques ouvertes par un jeton dans le chemin, quel que soit son format (hex, UUID, base64url)
const ROUTE_A_JETON = /(\/(?:portail|appreciation(?:\/[a-z]+)?|convention|contrat-formateur|certificat|mandat|positionnement|bilan|devenir-formateur|grilles|api\/grilles|site\/desinscription|desinscription|signer|signature|c|f)\/)([A-Za-z0-9_-]{16,})/gi
// Paramètres d'adresse qui portent un secret
const PARAM_SECRET = /([?&](?:token|key|cle|jeton|k|sig|signature|access_token)=)[^&#\s"']+/gi
// Liens publics Dendreo (documents sans connexion)
const DENDREO_PUBLIC = /https?:\/\/public\.dendreo\.com\/[^\s"'<>]+/gi
// Segment d'adresse de 40 caractères base64url et plus, masqué s'il a l'allure
// d'un jeton (majuscules, minuscules et chiffres mêlés) : une adresse de page
// du site (« formation-hygiene-alimentaire-… ») reste lisible
const SEGMENT_LONG = /(\/)([A-Za-z0-9_-]{40,})(?=[/?#"'\s]|$)/g
const ALLURE_JETON = (s: string) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s)

function masquerNir(v: unknown) {
  const s = String(v ?? '').replace(/\s/g, '')
  return s ? `masqué (se termine par ${s.slice(-2)})` : v
}

function masquerIban(v: unknown) {
  const s = String(v ?? '').replace(/\s/g, '')
  if (!s) return v
  return s.length > 8 ? `${s.slice(0, 4)} •••• ${s.slice(-4)}` : '••••'
}

/** Reste de la division par 97 d'un grand nombre écrit en chiffres */
function mod97(chiffres: string): number {
  let r = 0
  for (const c of chiffres) r = (r * 10 + Number(c)) % 97
  return r
}

/** NIR à 15 caractères (Corse : 2A, 2B), clé vérifiée */
function nirValide(brut: string): boolean {
  const s = brut.replace(/\s/g, '').toUpperCase()
  if (!/^[12]\d{2}(0[1-9]|1[0-2]|[2-9]\d)(\d{2}|2A|2B)\d{6}\d{2}$/.test(s)) return false
  const corps = s.slice(0, 13).replace('2A', '19').replace('2B', '18')
  return 97 - mod97(corps) === Number(s.slice(13))
}

/** IBAN : pays, clé et contrôle modulo 97 */
function ibanValide(brut: string): boolean {
  const s = brut.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const deplace = s.slice(4) + s.slice(0, 4)
  const chiffres = deplace.replace(/[A-Z]/g, (l) => String(l.charCodeAt(0) - 55))
  return mod97(chiffres) === 1
}

const NIR_TEXTE = /(?<![\dA-Za-z])[12][\s.]?\d{2}[\s.]?\d{2}[\s.]?(?:\d{2}|2[AB])[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{2}(?![\dA-Za-z])/g
// Mot de passe tapé dans une note (« mdp : … », « mot de passe = … ») : la valeur est masquée,
// quand elle a l'allure d'un mot de passe (chiffre ou caractère spécial)
const MOT_DE_PASSE_TEXTE = /((?:mot\s+de\s+passe|mdp|password|passwd|pwd|code\s+d['’]acc[eè]s)\s*(?:[:=]|est)?\s*)([^\s,;]{4,})/gi
const ALLURE_MOT_DE_PASSE = (s: string) => /\d/.test(s) || /[^A-Za-zÀ-ÿ'’.-]/.test(s)
const IBAN_TEXTE = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?(?![A-Za-z0-9])/g

function nettoyerTexte(s: string, base?: string): string {
  if (DATA_URI_SEUL.test(s) || BASE64_LONG.test(s)) return '[fichier retiré]'
  let t = s
    .replace(DATA_URI, '[fichier retiré]')
    .replace(SVG_EN_LIGNE, '[fichier retiré]')
    .replace(DENDREO_PUBLIC, '[lien Dendreo masqué]')
    .replace(PARAM_SECRET, '$1[masqué]')
    .replace(ROUTE_A_JETON, '$1[jeton masqué]')
    .replace(JETON_JWT, '[jeton masqué]')
    .replace(JETON_HEX, '[jeton masqué]')
    .replace(SEGMENT_LONG, (m, barre, segment) => (ALLURE_JETON(segment) ? `${barre}[jeton masqué]` : m))
    .replace(NIR_TEXTE, (m) => (nirValide(m) ? masquerNir(m) as string : m))
    .replace(IBAN_TEXTE, (m) => (ibanValide(m) ? masquerIban(m) as string : m))
    .replace(MOT_DE_PASSE_TEXTE, (m, libelle, valeur) => (ALLURE_MOT_DE_PASSE(valeur) ? `${libelle}[masqué]` : m))
  // Les liens relatifs de Starkk deviennent cliquables depuis Claude
  if (base && (t.startsWith('/dashboard/') || t.startsWith('/api/pdf/'))) t = base + t
  if (t.length > LONGUEUR_MAX) t = `${t.slice(0, LONGUEUR_MAX)} […] (tronqué : ${s.length} caractères)`
  return t
}

/**
 * Nettoie récursivement ce qui part vers Claude : colonnes et clés JSON
 * secrètes retirées, numéro de sécurité sociale et IBAN masqués, fichiers en
 * base64 et jetons remplacés, textes très longs tronqués.
 */
export function nettoyer(valeur: any, base?: string, profondeur = 0): any {
  if (valeur == null) return valeur
  if (profondeur > 8) return '[…]'
  if (typeof valeur === 'string') return nettoyerTexte(valeur, base)
  if (Array.isArray(valeur)) return valeur.map((v) => nettoyer(v, base, profondeur + 1))
  if (typeof valeur === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(valeur)) {
      if (estSecrete(k)) continue
      if (NIR.test(k)) { out[k] = v == null ? v : masquerNir(v); continue }
      if (IBAN.test(k)) { out[k] = v == null ? v : masquerIban(v); continue }
      out[k] = nettoyer(v, base, profondeur + 1)
    }
    return out
  }
  return valeur
}

/** Valeur d'une colonne nettoyée comme dans une ligne (masquage selon le nom de la colonne) */
export function nettoyerValeur(colonne: string, valeur: any, base?: string): any {
  if (estSecrete(colonne)) return '[retiré]'
  return nettoyer({ [colonne]: valeur }, base)[colonne]
}
