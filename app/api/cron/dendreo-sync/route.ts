import { NextResponse } from 'next/server'
import { runDendreoSync } from '@/lib/dendreo-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // la synchro complète peut prendre 1-2 min

// Synchro quotidienne Dendreo → CRM (Vercel Cron). Idempotente : n'insère que
// les nouveaux enregistrements (sessions, participants…) créés dans Dendreo.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const t0 = Date.now()
  try {
    const report = await runDendreoSync(true)
    const totalNew = Object.values(report).reduce((s: number, v: any) => s + (v.new || 0), 0)
    console.log(`[cron dendreo-sync] ${totalNew} nouveaux en ${Date.now() - t0}ms`, JSON.stringify(report))
    return NextResponse.json({ ok: true, ms: Date.now() - t0, totalNew, report })
  } catch (e: any) {
    console.error('[cron dendreo-sync] échec', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
