import { NextResponse } from 'next/server'
import { verifierSante } from '@/lib/sante'

export const dynamic = 'force-dynamic'

/**
 * État du CRM pour une surveillance extérieure (GitHub, UptimeRobot…) :
 * 200 quand la base, la connexion et le stockage répondent, 503 sinon.
 * Public et sans détail d'erreur : seulement l'état de chaque service.
 */
export async function GET() {
  const etat = await verifierSante()
  const services = Object.fromEntries(
    Object.entries(etat.services).map(([k, s]) => [k, { ok: s.ok, ms: s.ms }]),
  )
  return NextResponse.json(
    { ok: etat.ok, verifie_le: etat.verifieLe, services },
    { status: etat.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
