import { NextResponse } from 'next/server'
import { searchCompanies } from '@/lib/sirene'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Proxy serveur vers l'API recherche-entreprises.api.gouv.fr.
 * Enrichit chaque résultat avec :
 *   - libelle_naf : depuis notre table opco_naf_codes (= secteur d'activité)
 *   - code_idcc   : depuis siret_opco (3.38M SIRETs, fichier officiel data.gouv)
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
    if (companies.length === 0) return NextResponse.json({ companies })

    const supabase = await createServiceRoleClient()

    // Lookup batch : libellés NAF
    const nafCodes = [...new Set(companies.map(c => c.code_naf).filter(Boolean))]
    const { data: nafRows } = nafCodes.length > 0
      ? await supabase.from('opco_naf_codes').select('code_naf, libelle').in('code_naf', nafCodes)
      : { data: [] }
    const nafMap = new Map((nafRows || []).map((r: any) => [r.code_naf, r.libelle]))

    // Lookup batch : IDCC depuis siret_opco
    const sirets = companies.map(c => c.siret).filter(Boolean)
    const { data: siretRows } = sirets.length > 0
      ? await supabase.from('siret_opco').select('siret, idcc').in('siret', sirets)
      : { data: [] }
    const siretMap = new Map((siretRows || []).map((r: any) => [r.siret, r.idcc]))

    const enriched = companies.map(c => ({
      ...c,
      libelle_naf: nafMap.get(c.code_naf) || null,
      code_idcc: siretMap.get(c.siret) || null,
    }))

    return NextResponse.json({ companies: enriched })
  } catch (e) {
    return NextResponse.json(
      { companies: [], error: 'API recherche-entreprises momentanément indisponible' },
      { status: 503 }
    )
  }
}
