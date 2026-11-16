import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { peutGererVivier } from '@/lib/vivier-acces'

export const dynamic = 'force-dynamic'

/**
 * Ouvre le CV d'un candidat du vivier (`[id]` = identifiant du candidat).
 * Le lien est signé à la demande, pour une minute : le CV s'ouvre depuis
 * n'importe quel écran qui affiche le vivier, même resté ouvert des heures.
 * Données personnelles : compte non suspendu, rôle qui gère le vivier, même organisation.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabaseClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: me } = await supabase.from('users').select('role, status, organization_id').eq('id', user.id).maybeSingle()
  if (!me || me.status === 'suspended' || !peutGererVivier(me.role)) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

  const { data: cand } = await supabase.from('candidats_vivier')
    .select('cv_url, cv_nom').eq('id', params.id).eq('organization_id', me.organization_id).maybeSingle()
  if (!cand?.cv_url) return NextResponse.json({ error: 'CV introuvable' }, { status: 404 })

  // Ancien CV saisi sous forme de lien
  if (/^https?:\/\//.test(cand.cv_url)) return NextResponse.redirect(cand.cv_url)

  // PDF et images s'ouvrent dans le navigateur ; un fichier Word se télécharge sous son nom d'origine
  const apercu = /\.(pdf|jpe?g|png)$/i.test(cand.cv_url)
  const { data: signe, error } = await supabase.storage.from('documents')
    .createSignedUrl(cand.cv_url, 60, apercu ? {} : { download: cand.cv_nom || true })
  if (error || !signe?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible' }, { status: 404 })
  return NextResponse.redirect(signe.signedUrl)
}
