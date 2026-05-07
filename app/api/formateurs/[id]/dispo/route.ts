import { NextResponse } from 'next/server'
import { checkFormateurDisponibilite } from '@/lib/formateur-disponibilite'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  await getSession() // Auth check (redirige si pas connecté)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const excludeSessionId = searchParams.get('exclude_session_id') || undefined

  if (!from || !to) {
    return NextResponse.json({ error: 'from et to requis (YYYY-MM-DD)' }, { status: 400 })
  }

  const result = await checkFormateurDisponibilite(params.id, from, to, { excludeSessionId })
  return NextResponse.json(result)
}
