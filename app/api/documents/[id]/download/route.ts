import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { VISIBILITES_PAR_AUDIENCE } from '@/lib/session-contenu'

export const dynamic = 'force-dynamic'

/**
 * Un porteur de token de portail n'a le droit de télécharger un document que si
 * la visibilité ET l'appartenance sont vérifiées côté serveur :
 *   - formateur  : il anime la session
 *   - stagiaire  : il est inscrit à la session, document en 'stagiaires' ou 'tous'
 *   - client     : la session est la sienne, document en 'tous'
 * Tout autre cas (apporteur, document hors session…) est refusé.
 */
async function portalCanAccess(supabase: any, doc: any, token: string): Promise<boolean> {
  const { getPortalContext } = await import('@/lib/portal-auth')
  const context = await getPortalContext(token)
  if (!context) return false
  if (context.organization.id !== doc.organization_id) return false
  if (!doc.session_id) return false

  const { data: session } = await supabase
    .from('sessions')
    .select('id, formateur_id, client_id')
    .eq('id', doc.session_id)
    .maybeSingle()
  if (!session) return false

  const visibilite = doc.visibilite || 'formateur'

  if (context.type === 'formateur') {
    if (session.formateur_id !== context.formateur.id) return false
    return VISIBILITES_PAR_AUDIENCE.formateur.includes(visibilite)
  }

  if (context.type === 'apprenant') {
    if (!VISIBILITES_PAR_AUDIENCE.stagiaire.includes(visibilite)) return false
    const { data: inscription } = await supabase
      .from('inscriptions')
      .select('id')
      .eq('session_id', session.id)
      .eq('apprenant_id', context.apprenant.id)
      .not('status', 'in', '("annule","abandonne")')
      .limit(1)
      .maybeSingle()
    return !!inscription
  }

  if (context.type === 'client') {
    if (!VISIBILITES_PAR_AUDIENCE.client.includes(visibilite)) return false
    if (session.client_id && session.client_id === context.client.id) return true
    // Certaines sessions ne portent pas client_id : le lien passe par le dossier
    const { data: dossier } = await supabase
      .from('dossiers_formation')
      .select('id')
      .eq('session_id', session.id)
      .eq('client_id', context.client.id)
      .limit(1)
      .maybeSingle()
    return !!dossier
  }

  return false
}

// Téléchargement d'un document stocké (bucket privé) via une URL signée courte.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, file_name, organization_id, session_id, visibilite')
    .eq('id', params.id)
    .single()
  if (!doc?.storage_path) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  const portalToken = req.nextUrl.searchParams.get('token')
  if (portalToken) {
    const allowed = await portalCanAccess(supabase, doc, portalToken)
    if (!allowed) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  } else {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // ?inline=1 → aperçu dans le navigateur (PDF, images) ; sinon téléchargement
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const { data: signed, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 60, inline ? {} : { download: doc.file_name || undefined })
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Fichier indisponible' }, { status: 404 })
  }
  return NextResponse.redirect(signed.signedUrl)
}
