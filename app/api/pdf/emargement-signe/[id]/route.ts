import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { EmargementSignePDF } from '@/lib/pdf/emargement-signe-pdf'
import { fetchAllPaged } from '@/lib/supabase/fetch-all'

// Une POEI de 12 stagiaires sur 27 jours : plusieurs centaines de signatures à
// décoder ; sans durée déclarée, la fonction était coupée vers 10-15 s
export const maxDuration = 120

const ROLES_REFUSES = ['apprenant', 'apporteur_affaires', 'franchise']
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * PDF de la feuille d'émargement SIGNÉE (signatures numériques réelles des
 * stagiaires + signature de validation du formateur). Deux accès :
 *  - le formateur via son token de portail (session = la sienne),
 *  - un compte connecté de l'organisation : l'équipe, ou le formateur de la session.
 * ?du=AAAA-MM-JJ&au=AAAA-MM-JJ limite la feuille à une période (une semaine de
 * POEI) ; les jours à venir encore vides ne s'impriment pas.
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
    // L'utilisateur connecté doit appartenir à l'organisation de la session ;
    // les signatures sont des données personnelles : ni franchise, ni apporteur,
    // ni stagiaire, ni compte suspendu, et un formateur ne lit que ses sessions
    const { data: me } = await supabase.from('users').select('organization_id, role, status').eq('id', user.id).maybeSingle()
    if (!me || me.organization_id !== session.organization_id || me.status === 'suspended' || ROLES_REFUSES.includes(me.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    if (me.role === 'formateur') {
      const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', user.id).maybeSingle()
      if (!f || session.formateur_id !== f.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
  }

  const params2 = new URL(req.url).searchParams
  const du = params2.get('du') || ''
  const au = params2.get('au') || ''
  if ((du && !DATE.test(du)) || (au && !DATE.test(au))) {
    return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
  }

  const { data: formation } = await supabase.from('formations').select('*').eq('id', session.formation_id).single()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', session.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const { participantsFeuille } = await import('@/lib/emargement-participants')
  const periode = (q: any) => { if (du) q = q.gte('date', du); if (au) q = q.lte('date', au); return q }
  const [apprenants, lignes, { data: feuilles }] = await Promise.all([
    participantsFeuille(supabase, params.id),
    // Lecture paginée, ordre total : une POEI dépasse vite 1000 lignes
    fetchAllPaged((from, to) => periode(supabase
      .from('emargements')
      .select('id, apprenant_id, date, creneau, est_present, signature_data, signed_at, signed_via, motif_absence')
      .eq('session_id', params.id))
      .order('date', { ascending: true }).order('creneau').order('apprenant_id').order('id')
      .range(from, to)),
    periode(supabase
      .from('emargement_feuilles')
      .select('date, creneau, formateur_signature_data, validated_at')
      .eq('session_id', params.id)),
  ])
  // Les jours à venir encore vides n'ont rien à prouver : ils ne s'impriment pas
  const aujourdhui = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const emargements = (lignes as any[]).filter((e) => String(e.date) <= aujourdhui || e.signature_data || e.est_present || e.motif_absence)

  const buffer = await renderToBuffer(
    createElement(EmargementSignePDF, {
      session,
      formation,
      org,
      formateur: (session as any).formateur,
      apprenants,
      emargements,
      feuilles: (feuilles || []) as any[],
    }) as any,
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="emargement-signe-${session.reference || session.id}${du || au ? `-${du || 'debut'}-${au || 'fin'}` : ''}.pdf"`,
    },
  })
}
