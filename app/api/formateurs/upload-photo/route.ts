import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'formateurs'

export async function POST(req: Request) {
  await getSession()
  const supabase = await createServiceRoleClient()

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Image trop lourde (max 5 Mo)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'PNG, JPG ou WebP uniquement' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `photos/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ success: true, url: pub.publicUrl })
}
