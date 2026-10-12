import { NextResponse } from 'next/server'
import {
  LONGUEUR_MIN_ADRESSE,
  codePostalDansTexte,
  dedoublonnerSuggestions,
  estCodePostal,
  fusionnerSuggestions,
  nettoyerCodePostal,
  suggestionDepuisBan,
  type AdresseSuggestion,
} from '@/lib/adresse'

// Sans base ni session : au plus près de l'utilisateur, sans démarrage à froid.
export const runtime = 'edge'

/**
 * Suggestions d'adresses pour l'aide à la saisie (voir lib/adresse.ts).
 * Route publique : elle ne lit que la Base Adresse Nationale, servie par le
 * géocodage de la Géoplateforme (IGN), et sert aussi les formulaires du site.
 *
 *   GET /api/public/adresse?q=12 rue de la rep&cp=38200&limit=6
 *   → { suggestions: AdresseSuggestion[] }
 *
 * `cp` est le code postal déjà saisi dans le formulaire : les adresses de ce
 * code passent devant, sauf si le texte correspond nettement mieux ailleurs.
 */
const GEOCODAGE = 'https://data.geopf.fr/geocodage/search'
const DELAI_MS = 4000
const LIMITE_DEFAUT = 6
const LIMITE_MAX = 8

// Une même recherche donne la même réponse pendant des mois : le réseau de
// Vercel la garde un jour, le navigateur cinq minutes.
const CACHE = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800'

type Trouvee = { s: AdresseSuggestion; score: number }

async function interroger(q: string, limite: number, codePostal?: string): Promise<Trouvee[]> {
  const p = new URLSearchParams({ q, limit: String(limite), autocomplete: '1', index: 'address' })
  if (codePostal) p.set('postcode', codePostal)
  const controle = new AbortController()
  const minuterie = setTimeout(() => controle.abort(), DELAI_MS)
  try {
    const r = await fetch(`${GEOCODAGE}?${p}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controle.signal,
    })
    // 400 : texte que le géocodage ne sait pas lire, pas une panne
    if (r.status === 400) return []
    if (!r.ok) throw new Error(`géocodage ${r.status}`)
    const d = await r.json()
    const trouvees: Trouvee[] = []
    for (const f of Array.isArray(d?.features) ? d.features : []) {
      const s = suggestionDepuisBan(f)
      if (s) trouvees.push({ s, score: Number(f?.properties?.score) || 0 })
    }
    return trouvees
  } finally {
    clearTimeout(minuterie)
  }
}

function repondre(suggestions: AdresseSuggestion[], complet = true) {
  // Une réponse à qui il manque la moitié des résultats ne doit pas rester un jour en cache
  return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': complet ? CACHE : 'no-store' } })
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  // Le géocodage exige de 3 à 200 caractères, le premier étant une lettre ou un chiffre
  const q = (params.get('q') || '')
    .replace(/\s+/g, ' ')
    .replace(/^[^0-9a-zA-ZÀ-ÿŒœ]+/, '')
    .trim()
    .slice(0, 200)
  const demande = parseInt(params.get('limit') || '', 10)
  const limite = Math.min(Math.max(Number.isFinite(demande) ? demande : LIMITE_DEFAUT, 1), LIMITE_MAX)
  if (q.length < LONGUEUR_MIN_ADRESSE) return repondre([])

  const cpFormulaire = nettoyerCodePostal(params.get('cp'))
  // Un code postal écrit dans le texte l'emporte sur celui du formulaire
  const priorite = estCodePostal(cpFormulaire) && !codePostalDansTexte(q) ? cpFormulaire : null
  // Les communes entières sont écartées après coup : on demande un peu plus large
  const large = limite + 2

  try {
    if (!priorite) {
      const partout = await interroger(q, large)
      return repondre(dedoublonnerSuggestions(partout.map((x) => x.s), limite))
    }
    const [ici, partout] = await Promise.allSettled([interroger(q, large, priorite), interroger(q, large)])
    if (ici.status === 'rejected' && partout.status === 'rejected') throw partout.reason
    return repondre(
      fusionnerSuggestions(
        ici.status === 'fulfilled' ? ici.value : [],
        partout.status === 'fulfilled' ? partout.value : [],
        limite,
      ),
      ici.status === 'fulfilled' && partout.status === 'fulfilled',
    )
  } catch (e) {
    console.error('[adresse] géocodage indisponible', e)
    return NextResponse.json(
      { suggestions: [], indisponible: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
