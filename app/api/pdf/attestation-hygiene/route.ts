import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { withDocumentLogo } from '@/lib/pdf/org-logo'
import { AttestationHygienePDF } from '@/lib/pdf/attestation-hygiene-pdf'
import { estFormationHygiene } from '@/lib/formation-hygiene'

export const dynamic = 'force-dynamic'

/**
 * Attestation d'hygiène alimentaire de l'arrêté du 12 février 2024.
 *
 * Un exemplaire par stagiaire de la session, ou pour un seul si `apprenant`
 * est précisé. C'est le document que le restaurateur présente lors d'un
 * contrôle : il ne remplace ni l'attestation de fin de formation ni le
 * certificat de réalisation, il s'y ajoute.
 *
 *   /api/pdf/attestation-hygiene?session=<uuid>[&apprenant=<uuid>]
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId

  const sessionId = req.nextUrl.searchParams.get('session') || ''
  const apprenantId = req.nextUrl.searchParams.get('apprenant') || ''
  if (!sessionId) return NextResponse.json({ error: 'Session requise' }, { status: 400 })

  const supabase = await createServiceRoleClient()

  const [{ data: orgRow }, { data: sess }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    supabase.from('sessions')
      .select('id, reference, date_debut, date_fin, formation:formation_id(intitule, categorie, duree_heures)')
      .eq('id', sessionId).eq('organization_id', orgId).maybeSingle(),
  ])
  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const formation: any = (sess as any).formation
  if (!estFormationHygiene(formation)) {
    return NextResponse.json(
      { error: "Cette session ne porte pas sur l'hygiène alimentaire" },
      { status: 400 },
    )
  }

  let q = supabase.from('inscriptions')
    .select('apprenant_id, apprenant:apprenants(id, civilite, prenom, nom, date_naissance, entreprise)')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')
  if (apprenantId) q = q.eq('apprenant_id', apprenantId)
  const { data: inscriptions } = await q

  const apprenants = (inscriptions || [])
    .map((i: any) => i.apprenant)
    .filter(Boolean)
    .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))

  if (apprenants.length === 0) {
    return NextResponse.json({ error: 'Aucun stagiaire sur cette session' }, { status: 404 })
  }

  // La durée attestée est celle réellement suivie : c'est elle qui est
  // opposable lors d'un contrôle, pas la durée prévue au programme.
  const { data: em } = await supabase.from('emargements')
    .select('apprenant_id, est_present').eq('session_id', sessionId)
  const dureePrevue = Number(formation?.duree_heures || 0)
  const heuresParApprenant: Record<string, number> = {}
  for (const a of apprenants) {
    const lignes = (em || []).filter((e: any) => e.apprenant_id === a.id)
    const presents = lignes.filter((e: any) => e.est_present).length
    heuresParApprenant[a.id] = lignes.length > 0
      ? Math.round((dureePrevue * presents / lignes.length) * 100) / 100
      : dureePrevue
  }

  // Comme pour l'envoi automatique, aucune attestation à 0 heure une fois la
  // session passée. Avant sa fin, la grille n'est pas encore signée : le pack
  // Hygiène imprime les attestations à l'avance.
  const fin = String((sess as any).date_fin || '').slice(0, 10)
  const passee = !!fin && fin < new Date().toISOString().slice(0, 10)
  const aAttester = passee ? apprenants.filter((a: any) => (heuresParApprenant[a.id] || 0) > 0) : apprenants
  if (aAttester.length === 0) {
    return NextResponse.json(
      { error: apprenantId ? "Aucune présence relevée pour ce stagiaire : l'attestation attend ses émargements" : 'Aucune présence relevée sur cette session : les attestations attendent les émargements' },
      { status: 422 },
    )
  }

  const org = await withDocumentLogo(supabase, orgRow)

  const buffer = await renderToBuffer(
    createElement(AttestationHygienePDF, {
      apprenants: aAttester, session: sess as any, formation, org, heuresParApprenant,
    }) as any,
  )

  const nom = apprenantId && aAttester[0]
    ? `Attestation hygiene - ${aAttester[0].nom} ${aAttester[0].prenom}`
    : `Attestations hygiene - ${(sess as any).reference || 'session'}`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_')}.pdf"`,
    },
  })
}
