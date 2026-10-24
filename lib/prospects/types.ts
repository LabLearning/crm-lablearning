/**
 * Prospects entrants : un même circuit pour les trois canaux qui créent des
 * leads (le site, les formulaires publicitaires Meta, ceux de Google Ads).
 * Chaque canal traduit ce qu'il reçoit en ProspectEntrant, puis
 * recevoirProspect (lib/prospects/recevoir) fait le reste : journal,
 * dédoublonnage, lead, alerte de l'équipe commerciale.
 */

export type CanalProspect = 'site' | 'meta' | 'google_ads'

/** Source du lead (type lead_source) selon le canal de réception. */
export const SOURCE_PAR_CANAL: Record<CanalProspect, 'site_web' | 'meta_ads' | 'google_ads'> = {
  site: 'site_web',
  meta: 'meta_ads',
  google_ads: 'google_ads',
}

export const CANAL_LABELS: Record<CanalProspect, string> = {
  site: 'Site web',
  meta: 'Meta',
  google_ads: 'Google Ads',
}

/** Une question du formulaire et la réponse du prospect, telles qu'il les a vues. */
export interface ReponseProspect {
  question: string
  reponse: string
}

/**
 * D'où vient le prospect. Champs tous facultatifs : chaque canal remplit ce
 * qu'il connaît (Meta : campagne, annonce, formulaire, plateforme ; Google :
 * identifiants de campagne et gclid ; site : UTM et identifiants de clic).
 */
export interface AttributionProspect {
  canal?: CanalProspect
  /** facebook, instagram, messenger, audience_network, google, youtube… */
  plateforme?: string | null
  campagne?: string | null
  campagne_id?: string | null
  /** Ensemble de publicités (Meta) ou groupe d'annonces (Google) */
  ensemble?: string | null
  ensemble_id?: string | null
  annonce?: string | null
  annonce_id?: string | null
  formulaire?: string | null
  formulaire_id?: string | null
  /** Prospect venu d'un formulaire sans publicité payante (Meta) */
  organique?: boolean | null
  gclid?: string | null
  gclsrc?: string | null
  gbraid?: string | null
  wbraid?: string | null
  gad_source?: string | null
  gad_campaignid?: string | null
  fbclid?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
  /** Première page vue sur le site, et quand */
  page_arrivee?: string | null
  arrive_le?: string | null
}

export interface IdentiteProspect {
  prenom?: string | null
  nom?: string | null
  /** Nom complet quand le canal ne sépare pas prénom et nom */
  nomComplet?: string | null
  email?: string | null
  telephone?: string | null
  entreprise?: string | null
  ville?: string | null
  codePostal?: string | null
  poste?: string | null
}

export interface ProspectEntrant {
  canal: CanalProspect
  /** Identifiant du prospect chez le canal : une seule réception par identifiant */
  externeId?: string | null
  /** Envoi du formulaire chez le canal (ISO) */
  soumisLe?: string | null
  /** Prospect d'essai (outil de test Meta, bouton de test Google) : journal seulement */
  test?: boolean
  identite: IdentiteProspect
  reponses?: ReponseProspect[]
  attribution?: AttributionProspect | null
  /** Ce qui s'est passé, en une phrase : devient une ligne datée du commentaire du lead */
  evenement: string
  etiquettes?: string[]
  /** Envoi tel que reçu du canal (sans clé ni secret), gardé au journal : champs non documentés, rejeu */
  brut?: Record<string, unknown> | null
  /** Compléments propres à un formulaire */
  complements?: {
    effectif_libelle?: string | null
    formation_souhaitee?: string | null
  }
}

export type StatutReception = 'lead_cree' | 'lead_complete' | 'client_connu' | 'test' | 'erreur'

/**
 * deja_recu : traitée une fois, rien à refaire. en_cours : une autre livraison
 * la traite en ce moment (moins de 2 minutes) ; le canal doit renvoyer plus
 * tard (Google : réponse 503), la reprise viendra si elle a été coupée.
 */
export interface ResultatReception {
  statut: StatutReception | 'deja_recu' | 'en_cours'
  leadId: string | null
  clientId: string | null
  erreur?: string
}
