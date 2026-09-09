import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { resoudreContexte } from '@/lib/assistant/contexte'

/** Puce de contexte du widget : l'entité que l'utilisateur regarde. */
const ROLES_EQUIPE = ['super_admin', 'admin', 'gestionnaire', 'commercial', 'manager']

export async function GET(req: Request) {
  let session
  try { session = await getSession() } catch { return NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  if (!ROLES_EQUIPE.includes(session.user.role)) return NextResponse.json({ error: 'Réservé à l’équipe' }, { status: 403 })
  const chemin = new URL(req.url).searchParams.get('chemin')
  const ctx = await resoudreContexte(chemin, session.organization.id).catch(() => null)
  return NextResponse.json(ctx ? { type: ctx.type, libelle: ctx.libelle } : {})
}
