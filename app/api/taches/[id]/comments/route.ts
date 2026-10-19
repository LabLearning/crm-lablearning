import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { tacheAccessible } from '@/lib/taches-visibilite'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // La tâche est de l'organisme, et visible pour ce compte (lib/taches-visibilite)
  const tache = await tacheAccessible(supabase, session.organization.id, { id: session.user.id, role: session.user.role }, params.id)

  if (!tache) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: comments } = await supabase
    .from('crm_taches_commentaires')
    .select('id, contenu, created_at, author:users!crm_taches_commentaires_author_id_fkey(id, first_name, last_name, email)')
    .eq('tache_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ comments: comments || [] })
}
