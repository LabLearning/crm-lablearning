import type { AttributionProspect } from './types'

/**
 * Attribution envoyée par le navigateur avec un formulaire du site : on ne
 * garde que les champs connus, en texte court. Rien de ce qui vient du
 * navigateur n'est pris tel quel.
 */
const CHAMPS_SITE = [
  'gclid', 'gclsrc', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid', 'fbclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'page_arrivee', 'arrive_le',
] as const

export function nettoyerAttributionSite(brut: unknown): AttributionProspect | null {
  if (!brut || typeof brut !== 'object') return null
  const sortie: Record<string, string> = {}
  for (const champ of CHAMPS_SITE) {
    const v = (brut as Record<string, unknown>)[champ]
    if (typeof v !== 'string') continue
    const propre = v.replace(/[\u0000-\u001f<>"'`]/g, '').trim().slice(0, champ === 'page_arrivee' ? 300 : 200)
    if (propre) sortie[champ] = propre
  }
  if (sortie.arrive_le && Number.isNaN(Date.parse(sortie.arrive_le))) delete sortie.arrive_le
  if (sortie.page_arrivee && !sortie.page_arrivee.startsWith('/')) delete sortie.page_arrivee
  return Object.keys(sortie).length ? (sortie as AttributionProspect) : null
}

/**
 * Le canal publicitaire qui a amené le visiteur sur le site, d'après ses
 * identifiants de clic ou ses UTM : « google_ads », « meta » ou null.
 * Un identifiant Google (gclid…) ne vient que d'une annonce. Le fbclid, lui,
 * est ajouté par Facebook et Instagram à tout lien ouvert chez eux,
 * publication ou bio comprises : seul un support UTM payant (utm_medium=paid,
 * comme le conseille la page Canaux) fait conclure à une publicité Meta.
 */
export function canalPublicitaire(a: AttributionProspect | null | undefined): 'google_ads' | 'meta' | null {
  if (!a) return null
  if (a.gclid || a.gbraid || a.wbraid || a.gad_source || a.gad_campaignid) return 'google_ads'
  const source = String(a.utm_source || '').toLowerCase()
  const support = String(a.utm_medium || '').toLowerCase()
  const payant = /(^|[^a-z])(cpc|ppc|cpm|paid|ads?|display)([^a-z]|$)/.test(support)
  if (!payant) return null
  if (/(^|[^a-z])(google|adwords)([^a-z]|$)/.test(source)) return 'google_ads'
  if (a.fbclid || /(^|[^a-z])(facebook|instagram|meta|messenger|fb|ig)([^a-z]|$)/.test(source)) return 'meta'
  return null
}

/**
 * L'attribution dit-elle d'où vient le prospect (campagne, formulaire,
 * identifiant de clic, UTM) ? Un lead né sur le site sans publicité porte
 * seulement { canal } : une demande suivante venue d'une publicité la remplace.
 */
export function attributionUtile(a: object | null | undefined): boolean {
  if (!a || typeof a !== 'object') return false
  return ['campagne', 'campagne_id', 'annonce_id', 'formulaire_id', 'gclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid',
    'fbclid', 'utm_source', 'utm_medium', 'utm_campaign'].some((k) => {
    const v = (a as Record<string, unknown>)[k]
    return v !== null && v !== undefined && String(v).trim() !== ''
  })
}

/** Code d'erreur d'une colonne absente (avant la migration 167) : PostgreSQL ou cache de PostgREST. */
export function colonneAbsente(erreur: { code?: string; message?: string } | null | undefined): boolean {
  if (!erreur) return false
  return erreur.code === '42703' || erreur.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(erreur.message || '')
}
