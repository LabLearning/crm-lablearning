import { NextResponse } from 'next/server'
import { runDendreoSync } from '@/lib/dendreo-sync'
import type { BilanReconciliation } from '@/lib/dendreo-participants'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // la synchro complète peut prendre 1-2 min

// Synchro quotidienne Dendreo → CRM (Vercel Cron). Idempotente : n'insère que
// les nouveaux enregistrements (sessions, participants, inscriptions…) créés dans Dendreo.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  // Fail-closed : absence de CRON_SECRET = refus, jamais ouverture
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const t0 = Date.now()
  const ORG_ID = process.env.DENDREO_DEFAULT_ORG || 'ff747dfe-c034-44d8-98d7-e53892263fb5'
  try {
    const report = await runDendreoSync(true)
    const totalNew = Object.values(report).reduce((s: number, v: any) => s + (v.new || 0), 0)
    const { createServiceRoleClient } = await import('@/lib/supabase/server')
    const supabase = await createServiceRoleClient()

    // La synchro crée les fiches des participants, pas leurs inscriptions.
    // Seules les sessions récentes ou à venir : l'historique se rattrape à
    // part, sur une liste validée. Une session que la synchro vient de
    // recréer après sa suppression reste vide.
    let participants: BilanReconciliation | null = null
    try {
      const { reconcilierParticipantsDendreo, RECUL_JOURS_CRON } = await import('@/lib/dendreo-participants')
      const depuis = new Date(Date.now() - RECUL_JOURS_CRON * 86400000).toISOString().slice(0, 10)
      participants = await reconcilierParticipantsDendreo(supabase, ORG_ID, { depuis, ecarterRecreees: true })
    } catch (e) { console.error('[cron dendreo-sync] participants', e) }

    // Rattache automatiquement les QCM des formations aux sessions (dont celles
    // qui viennent d'être importées de Dendreo)
    let qcmLinks = 0, qcmReponses = 0
    try {
      const { backfillOrgQcmSessions } = await import('@/lib/qcm-autolink')
      const { backfillOrgQcmReponses } = await import('@/lib/qcm-auto-seed')
      qcmLinks = await backfillOrgQcmSessions(supabase, ORG_ID)
      // Semis silencieux des réponses (assignation lue par le portail apprenant)
      qcmReponses = await backfillOrgQcmReponses(supabase, ORG_ID)
    } catch (e) { console.error('[cron dendreo-sync] autolink/seed QCM', e) }
    console.log(`[cron dendreo-sync] ${totalNew} nouveaux, ${participants?.inscriptions_creees ?? 0} inscriptions (${participants?.a_verifier.length ?? 0} à vérifier, ${participants?.sessions_ignorees.length ?? 0} sessions écartées), ${qcmLinks} liens + ${qcmReponses} réponses QCM en ${Date.now() - t0}ms`, JSON.stringify({ report, participants }))
    return NextResponse.json({ ok: true, ms: Date.now() - t0, totalNew, qcmLinks, qcmReponses, report, participants })
  } catch (e: any) {
    console.error('[cron dendreo-sync] échec', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
