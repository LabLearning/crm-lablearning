import { accordCookies } from './CookieBanner'

/**
 * La publicité qui a amené le visiteur sur le site : identifiants de clic
 * Google (gclid, gclsrc, gbraid, wbraid, gad_source, gad_campaignid) ou Meta
 * (fbclid) et paramètres UTM de l'adresse d'arrivée. Envoyée avec les
 * formulaires du site, elle dit au commercial qu'un prospect « Site web »
 * vient d'une campagne.
 *
 * Seulement avec l'accord du visiteur pour cette finalité (« Publicité
 * d'arrivée » dans le bandeau, ou « Tout accepter ») : c'est la lecture
 * prudente des textes du CEPD et de la CNIL sur le suivi par l'adresse, même
 * sans rien stocker. L'accord donné sur la page
 * d'arrivée elle-même suffit (AttributionCapteur relit l'adresse à ce
 * moment). Gardée en mémoire le temps de la visite seulement : rien n'est
 * écrit sur l'appareil. Un retrait de l'accord l'efface.
 */

export interface AttributionSite {
  gclid?: string
  gclsrc?: string
  gbraid?: string
  wbraid?: string
  gad_source?: string
  gad_campaignid?: string
  fbclid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  page_arrivee?: string
  arrive_le?: string
}

const PARAMETRES = [
  'gclid', 'gclsrc', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid', 'fbclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
] as const

let visite: AttributionSite | null = null

/** Sur une page vue, ou dès l'accord donné : retient les paramètres publicitaires de l'adresse (le dernier clic l'emporte). */
export function capterAttribution() {
  if (typeof window === 'undefined') return
  if (!accordCookies('attribution')) { visite = null; return }
  const q = new URLSearchParams(window.location.search)
  const trouves: AttributionSite = {}
  for (const p of PARAMETRES) {
    const v = q.get(p)
    if (v) trouves[p] = v.slice(0, 200)
  }
  if (!Object.keys(trouves).length) return
  visite = { ...trouves, page_arrivee: window.location.pathname.slice(0, 300), arrive_le: new Date().toISOString() }
}

export function lireAttribution(): AttributionSite | null {
  if (typeof window === 'undefined') return null
  if (!accordCookies('attribution')) { visite = null; return null }
  return visite
}
