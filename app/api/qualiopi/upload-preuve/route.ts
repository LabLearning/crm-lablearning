import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 20 * 1024 * 1024
const ALLOWED = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function POST(req: Request) {
  const session = await getSession()
  if (session.user.role === 'formateur' || session.user.role === 'franchise') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  const supabase = await createServiceRoleClient()

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const indicateurId = fd.get('indicateur_id') as string | null
  const titre = (fd.get('titre') as string | null)?.trim()
  const description = (fd.get('description') as string | null)?.trim()

  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (!indicateurId) return NextResponse.json({ error: 'Indicateur manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop lourd (max 20 Mo)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Format non supporté (PDF, image, Word, Excel)' }, { status: 400 })

  // Vérifier que l'indicateur appartient à l'organisation
  const { data: ind } = await supabase
    .from('qualiopi_indicateurs')
    .select('id, indicateur')
    .eq('id', indicateurId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!ind) return NextResponse.json({ error: 'Indicateur introuvable' }, { status: 404 })

  const safeName = (file.name || 'preuve').replace(/[^\w.\-]+/g, '_').slice(0, 80)
  const ext = safeName.includes('.') ? safeName.split('.').pop() : 'pdf'
  const path = `qualiopi/${session.organization.id}/${indicateurId}/${Date.now()}-${safeName}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from('dossiers')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { error: insErr } = await supabase.from('qualiopi_preuves').insert({
    organization_id: session.organization.id,
    indicateur_id: indicateurId,
    titre: titre || file.name || 'Document',
    description: description || null,
    type: 'document',
    document_url: path,
    created_by: session.user.id,
  })
  if (insErr) {
    await supabase.storage.from('dossiers').remove([path])
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  await logAudit({ action: 'add_preuve', entity_type: 'qualiopi_indicateur', entity_id: indicateurId, details: { file: file.name } })
  revalidatePath('/dashboard/qualiopi')
  return NextResponse.json({ success: true })
}
