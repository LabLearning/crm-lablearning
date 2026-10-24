import { nettoyerExpediteurSms } from './regles'

/**
 * Réglages des campagnes, lus dans les variables d'environnement de Vercel
 * (jamais envoyés au navigateur, sauf ce que l'écran doit afficher) :
 * - BREVO_API_KEY : clé de l'API Brevo (compte de Lab Learning) ;
 * - BREVO_EXPEDITEUR_EMAIL : adresse d'envoi des e-mails, sur un domaine
 *   authentifié chez Brevo (DKIM, SPF) ; BREVO_EXPEDITEUR_NOM (« Lab Learning ») ;
 * - BREVO_REPONSE_EMAIL : adresse des réponses (contact@lab-learning.fr) ;
 * - STOP_SMS_NUMERO : numéro court « STOP au … » donné par Brevo pour la France ;
 * - EXPEDITEUR_SMS : nom affiché des SMS (11 caractères, « LabLearning ») ;
 * - BREVO_WEBHOOK_SECRET : clé de l'adresse du webhook Brevo (désinscriptions, rebonds) ;
 * - CAMPAGNES_SECRET : clé des liens de désinscription (dédiée et stable : la
 *   changer rendrait les liens déjà envoyés illisibles, sauf à garder l'ancienne
 *   dans CAMPAGNES_SECRETS_ANCIENS).
 */
export interface ConfigCampagnes {
  cleApi: string | null
  expediteurEmail: string | null
  expediteurNom: string
  reponseEmail: string
  numeroStop: string | null
  expediteurSms: string
  secretWebhook: string | null
  secretLiens: boolean
}

export function configCampagnes(): ConfigCampagnes {
  const env = process.env
  const numero = String(env.STOP_SMS_NUMERO || '').replace(/\D/g, '')
  return {
    cleApi: env.BREVO_API_KEY || null,
    expediteurEmail: env.BREVO_EXPEDITEUR_EMAIL || null,
    expediteurNom: env.BREVO_EXPEDITEUR_NOM || 'Lab Learning',
    reponseEmail: env.BREVO_REPONSE_EMAIL || 'contact@lab-learning.fr',
    numeroStop: /^\d{5}$/.test(numero) ? numero : null,
    expediteurSms: nettoyerExpediteurSms(env.EXPEDITEUR_SMS),
    secretWebhook: env.BREVO_WEBHOOK_SECRET || null,
    secretLiens: !!env.CAMPAGNES_SECRET,
  }
}

/** Ce qui manque pour envoyer sur ce canal (phrases à afficher), ou rien. */
export function manquesPourEnvoyer(canal: 'email' | 'sms', c: ConfigCampagnes = configCampagnes()): string[] {
  const manques: string[] = []
  if (!c.cleApi) manques.push('la clé de l’API Brevo (BREVO_API_KEY)')
  if (!c.secretLiens) manques.push('la clé des liens de désinscription (CAMPAGNES_SECRET, une longue suite de caractères au hasard, à ne plus changer)')
  if (canal === 'email' && !c.expediteurEmail) manques.push('l’adresse d’envoi authentifiée chez Brevo (BREVO_EXPEDITEUR_EMAIL)')
  if (canal === 'sms' && !c.numeroStop) manques.push('le numéro « STOP au … » donné par Brevo (STOP_SMS_NUMERO)')
  // Sans le webhook, un STOP, un rebond ou une plainte n'arriverait jamais dans les oppositions du CRM
  if (!c.secretWebhook) manques.push('la clé du webhook Brevo (BREVO_WEBHOOK_SECRET), puis le webhook déclaré chez Brevo')
  return manques
}

/** Adresses publiques : la page de désinscription est sur le site, le désabonnement en un clic sur le CRM. */
export const SITE_PUBLIC = 'https://www.lab-learning.fr'
export const URL_CRM = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
