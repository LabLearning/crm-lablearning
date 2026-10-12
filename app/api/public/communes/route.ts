import { NextResponse } from 'next/server'
import {
  LONGUEUR_MIN_VILLE,
  communeDepuisGeo,
  estCodePostal,
  nettoyerCodePostal,
  requeteCommune,
  type CommuneSuggestion,
} from '@/lib/adresse'

export const runtime = 'edge'

/**
 * Communes d'un code postal, ou communes par leur nom, pour l'aide à la saisie
 * (voir lib/adresse.ts). Route publique : elle ne lit que l'API Découpage
 * administratif (geo.api.gouv.fr).
 *
 *   GET /api/public/communes?cp=38200   → les communes de ce code, la plus peuplée d'abord
 *   GET /api/public/communes?nom=vien   → les communes dont le nom commence ainsi
 *   → { communes: CommuneSuggestion[] }
 *
 * Un CEDEX ou un code inconnu donne une liste vide, pas une erreur.
 */
const COMMUNES = 'https://geo.api.gouv.fr/communes'
const CHAMPS = 'nom,code,codesPostaux,codeDepartement,departement,population'
const DELAI_MS = 4000
const LIMITE_NOMS = 8

// Le découpage communal change une fois l'an : une semaine sur le réseau de
// Vercel, une heure dans le navigateur.
const CACHE = 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000'

async function interroger(params: Record<string, string>): Promise<CommuneSuggestion[]> {
  const p = new URLSearchParams({ ...params, fields: CHAMPS, format: 'json' })
  const controle = new AbortController()
  const minuterie = setTimeout(() => controle.abort(), DELAI_MS)
  try {
    const r = await fetch(`${COMMUNES}?${p}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controle.signal,
    })
    if (r.status === 400) return []
    if (!r.ok) throw new Error(`communes ${r.status}`)
    const d = await r.json()
    const communes: CommuneSuggestion[] = []
    for (const ligne of Array.isArray(d) ? d : []) {
      const c = communeDepuisGeo(ligne)
      if (c && c.codes_postaux.length) communes.push(c)
    }
    return communes
  } finally {
    clearTimeout(minuterie)
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const cp = nettoyerCodePostal(params.get('cp'))
  const nom = requeteCommune((params.get('nom') || '').slice(0, 80))

  try {
    let communes: CommuneSuggestion[] = []
    if (estCodePostal(cp)) {
      communes = (await interroger({ codePostal: cp })).sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    } else if (nom.length >= LONGUEUR_MIN_VILLE) {
      communes = await interroger({ nom, boost: 'population', limit: String(LIMITE_NOMS) })
    }
    return NextResponse.json({ communes }, { headers: { 'Cache-Control': CACHE } })
  } catch (e) {
    console.error('[communes] découpage administratif indisponible', e)
    return NextResponse.json(
      { communes: [], indisponible: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
