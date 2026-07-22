import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Keep-warm : appelé toutes les 5 min par Vercel Cron pour éviter les cold starts.
// - Réveille la fonction de rendu des pages (fetch d'une page réelle)
// - Garde la connexion Supabase chaude (requête minime)
export async function GET(req: Request) {
  // Auth : Vercel Cron envoie Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  // Fail-closed : absence de CRON_SECRET = refus, jamais ouverture
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const results: Record<string, string> = {}

  // 1. Réveiller la fonction pages (le login suffit : même runtime que le dashboard)
  try {
    const r = await fetch(`${appUrl}/login`, { method: 'GET', cache: 'no-store' })
    results.page = `HTTP ${r.status}`
  } catch (e: any) {
    results.page = `erreur: ${e?.message || e}`
  }

  // 2. Garder la connexion base chaude
  try {
    const supabase = await createServiceRoleClient()
    const { error } = await supabase.from('organizations').select('id', { head: true, count: 'exact' }).limit(1)
    results.db = error ? `erreur: ${error.message}` : 'ok'
  } catch (e: any) {
    results.db = `erreur: ${e?.message || e}`
  }

  return NextResponse.json({ warm: true, ...results })
}
