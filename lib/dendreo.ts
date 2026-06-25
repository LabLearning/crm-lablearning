// Client API Dendreo — https://pro.dendreo.com/{slug}/api/{resource}.php
// Auth : header Authorization: Token token="KEY" (ou ?key=KEY).
// Le compte (slug) et la clé viennent de l'environnement.

const BASE = process.env.DENDREO_API_BASE || `https://pro.dendreo.com/${process.env.DENDREO_SLUG || 'lab_learning'}/api`
const KEY = process.env.DENDREO_API_KEY || ''

export type DendreoResource =
  | 'entreprises' | 'contacts' | 'participants' | 'formateurs'
  | 'modules' | 'actions_de_formation' | 'creneaux' | 'factures'
  | 'financements' | 'sessions_permanentes' | 'participations'

function authHeaders(): Record<string, string> {
  return { Authorization: `Token token="${KEY}"`, Accept: 'application/json' }
}

/** Récupère une ressource Dendreo (liste complète ou filtrée). */
export async function dendreoList<T = any>(resource: DendreoResource, params: Record<string, string | number> = {}): Promise<T[]> {
  if (!KEY) throw new Error('DENDREO_API_KEY manquante')
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const url = `${BASE}/${resource}.php${qs.toString() ? `?${qs}` : ''}`
  const r = await fetch(url, { headers: authHeaders(), cache: 'no-store' })
  if (!r.ok) throw new Error(`Dendreo ${resource} → ${r.status} ${(await r.text()).slice(0, 300)}`)
  const data = await r.json()
  return Array.isArray(data) ? data : []
}

/** Récupère un enregistrement Dendreo par son id. */
export async function dendreoGet<T = any>(resource: DendreoResource, id: string | number): Promise<T | null> {
  if (!KEY) throw new Error('DENDREO_API_KEY manquante')
  const url = `${BASE}/${resource}.php?id=${encodeURIComponent(String(id))}`
  const r = await fetch(url, { headers: authHeaders(), cache: 'no-store' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Dendreo ${resource}/${id} → ${r.status}`)
  const data = await r.json()
  if (Array.isArray(data)) return (data[0] as T) || null
  return (data as T) || null
}

export const dendreoConfigured = () => !!KEY
