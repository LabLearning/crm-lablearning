import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 20 * 1024 * 1024 // 20 Mo
const BUCKET = 'documents'

// Extensions bureautiques + PDF + images courantes
const ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]

function sanitize(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120)
}

export async function POST(req: Request) {
  const supabase = await createServiceRoleClient()

  const fd = await req.formData()

  // Les portails (formateur qui téléverse le scan d'une feuille papier, etc.)
  // n'ont pas de session Supabase : ils s'authentifient par leur token.
  const portalToken = fd.get('portal_token') as string | null
  let organizationId: string
  if (portalToken) {
    const { getPortalContext } = await import('@/lib/portal-auth')
    const context = await getPortalContext(portalToken)
    // Seul le formateur téléverse depuis un portail (scan de feuille papier) :
    // n'ouvrons pas le dépôt de fichiers aux apprenants, clients et apporteurs
    if (!context || context.type !== 'formateur') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
    }
    organizationId = context.organization.id
  } else {
    const session = await getSession()
    organizationId = session.organization.id
  }

  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop lourd (max 20 Mo)' }, { status: 400 })
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (PDF, Word, Excel, PowerPoint, images, texte)' }, { status: 400 })
  }

  const cleanName = sanitize(file.name || 'document')
  const path = `${organizationId}/${Date.now()}-${Math.round(Math.random() * 1e6)}-${cleanName}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    storage_path: path,
    file_name: file.name || cleanName,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
  })
}
