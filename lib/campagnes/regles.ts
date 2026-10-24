/**
 * Règles des campagnes marketing, communes à l'écran et au serveur (rien qui
 * touche à la base).
 *
 * Cadre retenu (CNIL) : prospection de professionnels sur leur métier (la
 * formation de leur équipe), fondée sur l'intérêt légitime ; chaque message
 * dit qui l'envoie et permet de ne plus rien recevoir (lien de
 * désinscription, STOP). Les particuliers, eux, devraient avoir donné leur
 * accord : ils ne font partie d'aucune audience.
 * SMS : du lundi au samedi, de 8 h à 21 h 30 (heure de Paris), jamais un jour
 * férié ; Brevo refuse lui-même les SMS marketing de 22 h à 8 h, le dimanche
 * et les jours fériés.
 */

export type CanalCampagne = 'email' | 'sms'
export type StatutCampagne = 'brouillon' | 'programmee' | 'en_cours' | 'envoyee' | 'annulee'

export const STATUTS_CAMPAGNE: Record<StatutCampagne, string> = {
  brouillon: 'Brouillon',
  programmee: 'Programmée',
  en_cours: 'En cours d’envoi',
  envoyee: 'Envoyée',
  annulee: 'Annulée',
}

/** Début obligatoire d'un SMS : qui écrit */
export const PREFIXE_SMS = 'Lab Learning : '
/**
 * Fin obligatoire d'un SMS marketing : « STOP au » suivi du numéro court que
 * Brevo attribue au compte pour la France (variable STOP_SMS_NUMERO, lue côté
 * serveur). Tant qu'il manque, aucun SMS ne part.
 */
export const MENTION_STOP_ATTENTE = 'STOP au [numéro Brevo]'
export const mentionStop = (numero: string | null | undefined) => (numero ? `STOP au ${numero}` : MENTION_STOP_ATTENTE)
/** Expéditeur affiché des SMS : 11 caractères au plus, lettres et chiffres */
export const nettoyerExpediteurSms = (v: string | null | undefined) => (String(v || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 11) || 'LabLearning')

// ── Coordonnées ──────────────────────────────────────────────────────────

const EMAIL_VALIDE = /^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]{2,}$/

/** Adresse e-mail comparable (minuscules), ou null si elle n'est pas exploitable. */
export function cleEmail(email: string | null | undefined): string | null {
  const e = String(email || '').trim().toLowerCase()
  return EMAIL_VALIDE.test(e) ? e : null
}

/** Les 9 derniers chiffres d'un numéro : clé des oppositions (06…, +33 6…, 0033 6… se rejoignent). */
export function cleTelephone(tel: string | null | undefined): string | null {
  const chiffres = String(tel || '').replace(/\D/g, '')
  return chiffres.length >= 9 ? chiffres.slice(-9) : null
}

/**
 * Numéro de mobile français au format international sans « + » (336… ou
 * 337…), ou null : un SMS ne part que vers un mobile.
 */
export function numeroSmsFrance(tel: string | null | undefined): string | null {
  let c = String(tel || '').replace(/\D/g, '')
  if (c.startsWith('0033')) c = c.slice(2)
  // « +33 (0)6 12 34 56 78 » : le 0 entre parenthèses ne se compose pas
  if (c.length === 12 && c.startsWith('330')) c = `33${c.slice(3)}`
  if (c.length === 10 && c.startsWith('0')) c = `33${c.slice(1)}`
  return /^33[67]\d{8}$/.test(c) ? c : null
}

// ── Fenêtre d'envoi des SMS ──────────────────────────────────────────────

/** Dimanche de Pâques (algorithme de Meeus), à midi UTC */
function paques(annee: number): Date {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(annee, mois - 1, jour, 12))
}

/** Jour férié en France métropolitaine, pour une date « AAAA-MM-JJ » */
export function estFerieFrance(jour: string): boolean {
  const annee = Number(jour.slice(0, 4))
  const p = paques(annee)
  const decale = (n: number) => { const x = new Date(p); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(5, 10) }
  const feries = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25', decale(1), decale(39), decale(50)]
  return feries.includes(jour.slice(5, 10))
}

/** Date et heure de Paris d'un instant : jour « AAAA-MM-JJ », jour de la semaine (0 = dimanche), minutes depuis minuit */
function heureDeParis(instant: Date): { jour: string; jourSemaine: number; minutes: number } {
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(instant)
  const v = (t: string) => parties.find((p) => p.type === t)?.value || ''
  const semaine = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v('weekday'))
  return { jour: `${v('year')}-${v('month')}-${v('day')}`, jourSemaine: semaine, minutes: Number(v('hour')) * 60 + Number(v('minute')) }
}

const DEBUT_SMS = 8 * 60
const FIN_SMS = 21 * 60 + 30

/** Un SMS marketing peut-il partir à cet instant ? Lundi à samedi, 8 h à 21 h 30 à Paris, hors jours fériés. */
export function dansFenetreSms(instant: Date = new Date()): boolean {
  const { jour, jourSemaine, minutes } = heureDeParis(instant)
  return jourSemaine !== 0 && !estFerieFrance(jour) && minutes >= DEBUT_SMS && minutes < FIN_SMS
}

/** Premier instant (à 5 minutes près) où un SMS peut partir, à partir de `depuis`. */
export function prochaineFenetreSms(depuis: Date = new Date()): Date {
  let t = new Date(Math.ceil(depuis.getTime() / 300000) * 300000)
  for (let i = 0; i < 12 * 24 * 10 && !dansFenetreSms(t); i++) t = new Date(t.getTime() + 300000)
  return t
}

// ── Texte d'un SMS ───────────────────────────────────────────────────────

/** Caractères de l'alphabet GSM 7 bits (un SMS de 160) ; le reste (ç, â, ê, œ, emojis…) force l'Unicode (70) */
const GSM7 = new Set(Array.from(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
))
/** Caractères GSM qui en comptent deux (table d'extension) */
const GSM7_EXTENSION = new Set(Array.from('^{}\\[~]|€'))

/** Le message complet d'un SMS : « Lab Learning : » devant, la mention STOP à la fin. */
export function composerSms(contenu: string, numeroStop: string | null | undefined): string {
  let texte = String(contenu || '').replace(/\r\n?/g, '\n').trim()
    // Une mention STOP écrite à la main est remplacée par la bonne
    .replace(/\s*stop au (\d{5}|\[numéro brevo\])\s*$/i, '')
  if (!texte.toLowerCase().startsWith(PREFIXE_SMS.trim().toLowerCase())) texte = `${PREFIXE_SMS}${texte}`
  return `${texte} ${mentionStop(numeroStop)}`
}

/** Nombre de SMS facturés et encodage, pour le compteur de l'écran. */
export function compterSms(texte: string): { caracteres: number; sms: number; unicode: boolean } {
  const lettres = Array.from(texte)
  const unicode = lettres.some((c) => !GSM7.has(c) && !GSM7_EXTENSION.has(c))
  const caracteres = unicode ? lettres.length : lettres.reduce((n, c) => n + (GSM7_EXTENSION.has(c) ? 2 : 1), 0)
  const [seul, partie] = unicode ? [70, 67] : [160, 153]
  return { caracteres, unicode, sms: caracteres <= seul ? 1 : Math.ceil(caracteres / partie) }
}

/** Au-delà, la campagne est refusée : un SMS de plus de 4 parties coûte cher et se lit mal. */
export const MAX_PARTIES_SMS = 4

// ── Personnalisation ─────────────────────────────────────────────────────

/**
 * Valeur saisie par un prospect (prénom, établissement), sûre à glisser dans
 * un message : sans adresse web, e-mail ni nom de domaine (un formulaire du
 * site pourrait sinon faire envoyer un lien piégé sous le nom de Lab Learning),
 * espaces réduits, longueur bornée. Sinon null : le texte de repli s'applique.
 */
export function valeurSure(v: string | null | undefined, max: number): string | null {
  const t = String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t || t.length > max) return null
  if (/:\/\/|www\.|@|[a-z0-9-]\.(fr|com|net|org|io|co|info|biz|eu|be|ch|xyz|app|site|online|shop|link|ly)\b/i.test(t)) return null
  return t
}

/** Prénom : des lettres, espaces, apostrophes et traits d'union seulement. */
const PRENOM_VALIDE = /^[\p{L}][\p{L}\p{M}' ’.-]{0,39}$/u

/**
 * {prenom} et {etablissement} remplacés ; « Bonjour {prenom}, » devient
 * « Bonjour, » sans prénom (ou si celui saisi n'est pas un prénom).
 * `echapper` sert à l'e-mail : les valeurs y entrent échappées, jamais en lien.
 */
export function personnaliser(texte: string, personne: { prenom?: string | null; etablissement?: string | null }, echapper: (v: string) => string = (v) => v): string {
  const brut = valeurSure(personne.prenom, 40)
  const prenom = brut && PRENOM_VALIDE.test(brut) ? echapper(brut) : ''
  const etablissement = echapper(valeurSure(personne.etablissement, 80) || 'votre établissement')
  return String(texte || '')
    .replace(/ ?\{prenom\}/g, (m) => (prenom ? `${m.startsWith(' ') ? ' ' : ''}${prenom}` : ''))
    .replace(/\{etablissement\}/g, etablissement)
}
