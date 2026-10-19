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

  const { data: memos } = await supabase
    .from('crm_taches_memos')
    .select('id, audio_path, duree_secondes, created_at, author:users!crm_taches_memos_author_id_fkey(id, first_name, last_name)')
    .eq('tache_id', params.id)
    .order('created_at', { ascending: true })

  // URLs signées pour lecture (bucket privé)
  const paths = (memos || []).map((m: any) => m.audio_path).filter(Boolean)
  const urls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrls(paths, 3600)
    ;(signed || []).forEach((s: any, i: number) => { if (s?.signedUrl && !s.error) urls[paths[i]] = s.signedUrl })
  }
  const rows = (memos || []).map((m: any) => ({ ...m, url: urls[m.audio_path] || null }))
  return NextResponse.json({ memos: rows })
}
