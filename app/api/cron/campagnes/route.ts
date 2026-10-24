import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { traiterCampagnes } from '@/lib/campagnes/envoi'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Envoi des campagnes marketing, toutes les 5 minutes (Vercel Cron) : lance
 * les campagnes programmées dont l'heure est venue, puis envoie un lot de
 * chaque campagne en cours (lib/campagnes/envoi). Sans clé Brevo, rien ne part.
 */
export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET
  if (!attendu || req.headers.get('authorization') !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const supabase = await createServiceRoleClient()
  try {
    return NextResponse.json(await traiterCampagnes(supabase))
  } catch (e: any) {
    // Avant la migration 168, les tables n'existent pas : rien à faire
    console.error('[campagnes] passage', e?.message || e)
    return NextResponse.json({ lancees: 0, envois: 0, erreurs: [String(e?.message || e).slice(0, 300)] })
  }
}
