import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

export async function POST(req: Request) {
  const session = await getSession()
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Réservé au super admin' }, { status: 403 })
  }
  const supabase = await createServiceRoleClient()

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop lourd (max 5 Mo)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'PNG, JPG, SVG ou WebP uniquement' }, { status: 400 })

  // Supprimer l'ancien logo si présent
  const { data: org } = await supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', session.organization.id)
    .single()
  if (org?.logo_url) {
    const oldPath = org.logo_url.split('/organisation/')[1]
    if (oldPath) await supabase.storage.from('organisation').remove([oldPath])
  }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${session.organization.id}/logo-${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from('organisation')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from('organisation').getPublicUrl(path)
  const url = pub.publicUrl

  await supabase
    .from('organizations')
    .update({ logo_url: url })
    .eq('id', session.organization.id)

  await logAudit({ action: 'upload_logo', entity_type: 'organization', entity_id: session.organization.id })
  revalidatePath('/dashboard/settings')
  return NextResponse.json({ success: true, url, filename: file.name })
}

export async function DELETE() {
  const session = await getSession()
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Réservé au super admin' }, { status: 403 })
  }
  const supabase = await createServiceRoleClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', session.organization.id)
    .single()
  if (org?.logo_url) {
    const oldPath = org.logo_url.split('/organisation/')[1]
    if (oldPath) await supabase.storage.from('organisation').remove([oldPath])
  }

  await supabase
    .from('organizations')
    .update({ logo_url: null })
    .eq('id', session.organization.id)

  await logAudit({ action: 'delete_logo', entity_type: 'organization', entity_id: session.organization.id })
  revalidatePath('/dashboard/settings')
  return NextResponse.json({ success: true })
}
