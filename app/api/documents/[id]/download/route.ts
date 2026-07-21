import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Téléchargement d'un document stocké (bucket privé) via une URL signée courte.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, file_name, organization_id')
    .eq('id', params.id)
    .single()
  if (!doc?.storage_path) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  const { data: signed, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name || undefined })
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Fichier indisponible' }, { status: 404 })
  }
  return NextResponse.redirect(signed.signedUrl)
}
