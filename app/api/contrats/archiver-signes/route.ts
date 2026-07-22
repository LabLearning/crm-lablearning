import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Fige dans le stockage tous les contrats signés qui ne le sont pas encore.
 *
 * À lancer APRÈS toute évolution du gabarit de contrat, mais AVANT de la
 * déployer : sans cela, un contrat déjà signé serait re-rendu avec les
 * nouvelles clauses, et engagerait le formateur sur un texte qu'il n'a
 * jamais accepté. Idempotente : ne retouche jamais un contrat déjà archivé.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  // Fail-closed : absence de CRON_SECRET = refus, jamais ouverture
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()
  const { data: contrats } = await supabase
    .from('contrats_formateur')
    .select('id, numero')
    .not('signature_formateur_date', 'is', null)
    .is('storage_path', null)

  const { archiveSignedContrat } = await import('@/lib/contrat-formateur')
  const resultats: { numero: string | null; ok: boolean; erreur?: string }[] = []

  for (const c of contrats || []) {
    try {
      await archiveSignedContrat(supabase, c.id)
      const { data: apres } = await supabase
        .from('contrats_formateur').select('storage_path').eq('id', c.id).single()
      resultats.push({ numero: c.numero, ok: Boolean(apres?.storage_path) })
    } catch (e: any) {
      resultats.push({ numero: c.numero, ok: false, erreur: e?.message || 'erreur' })
    }
  }

  const archives = resultats.filter((r) => r.ok).length
  console.log(`[archiver-signes] ${archives}/${resultats.length} contrats figés`)
  return NextResponse.json({ total: resultats.length, archives, resultats })
}
