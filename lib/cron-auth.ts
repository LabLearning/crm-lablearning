import { NextResponse } from 'next/server'

/**
 * Vérifie le secret d'une route de cron.
 *
 * Deux défauts corrigés ici :
 *  - fail-open : `if (expected && …)` laissait passer TOUT LE MONDE quand
 *    CRON_SECRET était absent de l'environnement ;
 *  - le secret (voire la clé service_role) était accepté en paramètre d'URL,
 *    donc journalisé par les proxys et Vercel.
 *
 * On échoue fermé et on n'accepte QUE l'en-tête Authorization.
 */
export function verifyCronSecret(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  // Absence de secret configuré = refus, jamais ouverture
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  return null
}
