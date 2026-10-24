import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { canauxMetaActifs, releverMeta } from '@/lib/prospects/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Relevé des prospects Meta, toutes les 10 minutes (Vercel Cron) : lit les
 * prospects récents de chaque formulaire de la Page, au cas où une
 * notification du webhook se serait perdue. Les prospects déjà reçus sont
 * reconnus par le journal (prospects_recus) et ne sont pas relus.
 */
export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET
  if (!attendu || req.headers.get('authorization') !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const supabase = await createServiceRoleClient()
  let canaux: Awaited<ReturnType<typeof canauxMetaActifs>> = []
  try { canaux = await canauxMetaActifs(supabase) } catch { canaux = [] }
  const bilans = []
  for (const canal of canaux) {
    bilans.push({ organisation: canal.organization_id, ...(await releverMeta(supabase, canal)) })
  }
  return NextResponse.json({ canaux: canaux.length, bilans })
}
