import { NextResponse } from 'next/server'
import { searchCompanies } from '@/lib/sirene'

/**
 * Proxy serveur vers l'API recherche-entreprises.api.gouv.fr.
 * Permet de contourner les éventuels problèmes réseau côté client
 * et d'ajouter du caching ou retry logic si besoin.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') || '8', 10)

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ companies: [] })
  }

  try {
    const companies = await searchCompanies(q, limit)
    return NextResponse.json({ companies })
  } catch (e) {
    return NextResponse.json(
      { companies: [], error: 'API recherche-entreprises momentanément indisponible' },
      { status: 503 }
    )
  }
}
