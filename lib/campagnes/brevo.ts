/**
 * Appels à l'API de Brevo (v3) : un e-mail ou un SMS à la fois, pour que
 * chaque destinataire ait son lien de désinscription et son résultat.
 * E-mail : POST /v3/smtp/email ; SMS : POST /v3/transactionalSMS/send, type
 * « marketing » (Brevo refuse lui-même les SMS marketing la nuit, le dimanche
 * et les jours fériés). Module serveur : la clé ne quitte jamais le serveur.
 */
const API = 'https://api.brevo.com/v3'

/**
 * Portée d'une erreur de Brevo, qui décide du sort de l'envoi :
 * - destinataire : ce message est refusé pour cette adresse ou ce numéro
 *   (invalide) : échec, on passe au suivant ;
 * - compte : clé, crédits, expéditeur, validation du compte, quota, panne :
 *   rien n'est dû au destinataire, l'envoi attend le passage suivant ;
 * - inconnue : délai dépassé après l'envoi de la requête, Brevo a peut-être
 *   envoyé : jamais renvoyé (un doublon chez le destinataire est pire).
 */
export type PorteeErreur = 'destinataire' | 'compte' | 'inconnue'

export class ErreurBrevo extends Error {
  constructor(message: string, public statut: number | undefined, public portee: PorteeErreur) { super(message) }
}

async function appeler<T>(cleApi: string, chemin: string, corps: unknown): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`${API}${chemin}`, {
      method: 'POST',
      headers: { 'api-key': cleApi, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(corps),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
  } catch (e: any) {
    if (e?.name === 'TimeoutError') throw new ErreurBrevo('Brevo n’a pas répondu à temps : envoi peut-être parti, non renvoyé', undefined, 'inconnue')
    throw new ErreurBrevo('Brevo ne répond pas (réseau) : nouvel essai au passage suivant', undefined, 'compte')
  }
  let texte = ''
  try {
    texte = await reponse.text()
  } catch {
    // Coupure pendant la lecture de la réponse : acceptée (2xx), le message est parti ; sinon, état inconnu, jamais renvoyé
    if (reponse.ok) return {} as T
    throw new ErreurBrevo('Réponse de Brevo illisible : envoi peut-être parti, non renvoyé', reponse.status, 'inconnue')
  }
  let donnees: any = null
  try { donnees = texte ? JSON.parse(texte) : null } catch { /* réponse non JSON */ }
  if (!reponse.ok) {
    const message = String(donnees?.message || donnees?.code || texte || `erreur ${reponse.status}`).slice(0, 300)
    // Seule une adresse ou un numéro refusé est propre au destinataire ; tout le reste (crédits 402, clé 401,
    // compte ou expéditeur 403 ou 400, quota 429, panne 5xx) attend le passage suivant, sans échec chez personne
    const surDestinataire = reponse.status === 400 && /email|e-mail|recipient|phone|mobile|number|numéro|destinataire/i.test(message)
      && !/sender|expéditeur|credit|crédit|account|compte|permission|template/i.test(message)
    const lisible = reponse.status === 401 ? 'Clé de l’API Brevo refusée : vérifiez BREVO_API_KEY'
      : reponse.status === 402 ? 'Crédits Brevo épuisés : rechargez le compte, l’envoi reprendra'
      : `Brevo : ${message}`
    throw new ErreurBrevo(lisible, reponse.status, surDestinataire ? 'destinataire' : 'compte')
  }
  return donnees as T
}

export async function envoyerEmailBrevo(cleApi: string, m: {
  expediteur: { email: string; nom: string }
  reponse: string
  destinataire: { email: string; nom?: string | null }
  objet: string
  html: string
  texte: string
  enTetes?: Record<string, string>
  etiquettes?: string[]
}): Promise<string | null> {
  const r = await appeler<{ messageId?: string }>(cleApi, '/smtp/email', {
    sender: { email: m.expediteur.email, name: m.expediteur.nom.slice(0, 70) },
    replyTo: { email: m.reponse },
    to: [{ email: m.destinataire.email, ...(m.destinataire.nom ? { name: m.destinataire.nom.slice(0, 70) } : {}) }],
    subject: m.objet,
    htmlContent: m.html,
    textContent: m.texte,
    ...(m.enTetes ? { headers: m.enTetes } : {}),
    ...(m.etiquettes?.length ? { tags: m.etiquettes.slice(0, 10) } : {}),
  })
  // Identifiant gardé sans chevrons : le webhook de Brevo le renvoie tantôt avec, tantôt sans
  return r?.messageId ? String(r.messageId).replace(/[<>]/g, '') : null
}

export async function envoyerSmsBrevo(cleApi: string, m: {
  expediteur: string
  numero: string
  texte: string
  unicode: boolean
  etiquette?: string
}): Promise<string | null> {
  const r = await appeler<{ messageId?: number | string }>(cleApi, '/transactionalSMS/send', {
    sender: m.expediteur,
    recipient: m.numero,
    content: m.texte,
    type: 'marketing',
    unicodeEnabled: m.unicode,
    ...(m.etiquette ? { tag: m.etiquette } : {}),
  })
  return r?.messageId !== undefined && r?.messageId !== null ? String(r.messageId) : null
}
