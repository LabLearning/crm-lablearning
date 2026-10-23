import { NextResponse } from 'next/server'
import { checkFormateurDisponibilite } from '@/lib/formateur-disponibilite'
import { getSession } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Disponibilité d'un formateur sur une plage : ses autres sessions et les
 * événements de son agenda Google. C'est son agenda : réservé au personnel qui
 * planifie les sessions, et aux formateurs de l'organisme.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession() // Auth check (redirige si pas connecté)
  if (!checkDashboardAccess('/dashboard/sessions', session.user.role as any, session.permissions).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const excludeSessionId = searchParams.get('exclude_session_id') || undefined

  if (!from || !to || !DATE_ISO.test(from) || !DATE_ISO.test(to)) {
    return NextResponse.json({ error: 'from et to requis (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()
  const { data: formateur } = await supabase
    .from('formateurs').select('id').eq('id', params.id).eq('organization_id', session.organization.id).maybeSingle()
  if (!formateur) return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })

  const result = await checkFormateurDisponibilite(params.id, from, to, { excludeSessionId })
  return NextResponse.json(result)
}
