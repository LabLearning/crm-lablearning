import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 10 * 1024 * 1024  // 10 MB
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg']

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop lourd (max 10 Mo)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Type de fichier non supporté (PDF, PNG, JPG)' }, { status: 400 })

  // Vérifier que le dossier appartient à l'org
  const { data: dossier } = await supabase
    .from('dossiers_formation')
    .select('id, organization_id, accord_prise_en_charge_url')
    .eq('id', params.id)
    .eq('organization_id', session.organization.id)
    .single()
  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  // Supprimer l'ancien fichier s'il existe
  if (dossier.accord_prise_en_charge_url) {
    const oldPath = dossier.accord_prise_en_charge_url.split('/dossiers/')[1]
    if (oldPath) await supabase.storage.from('dossiers').remove([oldPath])
  }

  // Upload nouveau fichier
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `${session.organization.id}/${params.id}/accord-opco-${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from('dossiers')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // URL publique signée (long terme — 10 ans pour l'archivage)
  const { data: signed } = await supabase.storage
    .from('dossiers')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

  const url = signed?.signedUrl || path

  await supabase
    .from('dossiers_formation')
    .update({
      accord_prise_en_charge_url: url,
      accord_prise_en_charge_uploaded_at: new Date().toISOString(),
      accord_prise_en_charge_filename: file.name,
    })
    .eq('id', params.id)

  await logAudit({ action: 'upload_accord_opco', entity_type: 'dossier_formation', entity_id: params.id, details: { filename: file.name } })
  revalidatePath(`/dashboard/dossiers/${params.id}`)

  return NextResponse.json({ success: true, url, filename: file.name })
}
