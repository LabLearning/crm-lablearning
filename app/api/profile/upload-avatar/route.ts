import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'organisation'

// Supprime l'ancien avatar uploadé (s'il était dans notre bucket)
async function removeOld(supabase: any, url: string | null | undefined) {
  if (!url) return
  const path = url.split(`/${BUCKET}/`)[1]
  if (path && path.startsWith('avatars/')) await supabase.storage.from(BUCKET).remove([path])
}

export async function POST(req: Request) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Image trop lourde (max 5 Mo)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'PNG, JPG ou WebP uniquement' }, { status: 400 })

  const { data: me } = await supabase.from('users').select('avatar_url').eq('id', session.user.id).single()
  await removeOld(supabase, me?.avatar_url)

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `avatars/${session.user.id}-${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  await supabase.from('users').update({ avatar_url: url }).eq('id', session.user.id)
  await logAudit({ action: 'update_avatar', entity_type: 'user', entity_id: session.user.id })
  revalidatePath('/dashboard', 'layout')
  return NextResponse.json({ success: true, url })
}

export async function DELETE() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: me } = await supabase.from('users').select('avatar_url').eq('id', session.user.id).single()
  await removeOld(supabase, me?.avatar_url)

  await supabase.from('users').update({ avatar_url: null }).eq('id', session.user.id)
  await logAudit({ action: 'delete_avatar', entity_type: 'user', entity_id: session.user.id })
  revalidatePath('/dashboard', 'layout')
  return NextResponse.json({ success: true })
}
