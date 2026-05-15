/**
 * Cron J+90 : crée les QCM "satisfaction_froid" pour les apprenants
 * des sessions terminées il y a 90 jours.
 * Appelé chaque matin par Vercel Cron.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { seedQcmReponsesForSession, notifyApprenantsForQcm } from '@/lib/qcm-auto-seed'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  const { searchParams } = new URL(req.url)
  const querySecret = searchParams.get('secret')

  if (authHeader !== `Bearer ${expected}` && querySecret !== expected && querySecret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Date cible : J-90 (sessions qui se sont terminées il y a 90 jours)
  const target = new Date()
  target.setDate(target.getDate() - 90)
  const targetDate = target.toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('date_fin', targetDate)
    .eq('status', 'terminee')

  let processed = 0
  let created = 0

  for (const s of sessions || []) {
    const r = await seedQcmReponsesForSession(supabase, s.id, 'satisfaction_froid')
    if (r.created > 0) {
      await notifyApprenantsForQcm(supabase, s.id, 'satisfaction_froid')
      created += r.created
    }
    processed++
  }

  return NextResponse.json({ targetDate, sessions_processed: processed, qcm_reponses_created: created })
}
