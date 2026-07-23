import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { EmargementSignePDF } from '@/lib/pdf/emargement-signe-pdf'

/**
 * PDF de la feuille d'émargement SIGNÉE (signatures numériques réelles des
 * stagiaires + signature de validation du formateur). Deux accès :
 *  - le formateur via son token de portail (session = la sienne),
 *  - l'admin connecté (session Supabase).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('*, formateur:formateurs(prenom, nom)')
    .eq('id', params.id)
    .single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const portalToken = new URL(req.url).searchParams.get('token')
  if (portalToken) {
    const { getPortalContext } = await import('@/lib/portal-auth')
    const context = await getPortalContext(portalToken)
    if (!context || context.type !== 'formateur' || session.formateur_id !== context.formateur.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  } else {
    const anonClient = await createServerSupabaseClient()
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    // L'utilisateur connecté doit appartenir à l'organisation de la session
    const { data: me } = await supabase.from('users').select('organization_id').eq('id', user.id).maybeSingle()
    if (!me || me.organization_id !== session.organization_id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
  }

  const { data: formation } = await supabase.from('formations').select('*').eq('id', session.formation_id).single()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', session.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const [{ data: inscriptions }, { data: emargements }, { data: feuilles }] = await Promise.all([
    supabase
      .from('inscriptions')
      .select('apprenant:apprenants(id, prenom, nom, entreprise)')
      .eq('session_id', params.id)
      .not('status', 'in', '("annule","abandonne")'),
    supabase
      .from('emargements')
      .select('apprenant_id, date, creneau, est_present, signature_data, signed_at, motif_absence')
      .eq('session_id', params.id)
      .order('date', { ascending: true }),
    supabase
      .from('emargement_feuilles')
      .select('date, creneau, formateur_signature_data, validated_at')
      .eq('session_id', params.id),
  ])

  const apprenants = (inscriptions || []).map((i: any) => i.apprenant).filter(Boolean)

  const buffer = await renderToBuffer(
    createElement(EmargementSignePDF, {
      session,
      formation,
      org,
      formateur: (session as any).formateur,
      apprenants,
      emargements: (emargements || []) as any[],
      feuilles: (feuilles || []) as any[],
    }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="emargement-signe-${session.reference || session.id}.pdf"`,
    },
  })
}
