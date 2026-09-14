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
 *
 * Sur un parcours POEI, le module hygiène n'est pas une session à part : sa
 * durée est saisie par le gestionnaire (14 h par défaut, l'obligation de
 * l'arrêté du 12 février 2024) et l'attestation se tire du parcours.
 *
 *   /api/pdf/attestation-hygiene?poei=<uuid>[&candidat=<uuid>][&heures=14]
 */

/** Durée réglementaire du module hygiène d'un parcours POEI. */
const HEURES_HYGIENE_POEI = 14

/** Intitulé porté sur les attestations du module hygiène d'une POEI. */
const INTITULE_MODULE_HYGIENE = 'Hygiène alimentaire et prévention des risques'
export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId

  const sessionId = req.nextUrl.searchParams.get('session') || ''
  const apprenantId = req.nextUrl.searchParams.get('apprenant') || ''
  const poeiId = req.nextUrl.searchParams.get('poei') || ''
  const candidatId = req.nextUrl.searchParams.get('candidat') || ''
  if (!sessionId && !poeiId) return NextResponse.json({ error: 'Session ou parcours POEI requis' }, { status: 400 })

  const supabase = await createServiceRoleClient()

  if (poeiId) return attestationsPoei(supabase, orgId, poeiId, candidatId, req.nextUrl.searchParams.get('heures'))

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

/**
 * Attestations d'hygiène d'un parcours POEI. Le module est un volet du
 * parcours : ni session ni émargement propre, la durée attestée est celle
 * saisie, jamais nulle.
 */
async function attestationsPoei(
  supabase: any,
  orgId: string,
  poeiId: string,
  candidatId: string,
  heuresParam: string | null,
): Promise<NextResponse> {
  const heures = heuresParam ? Number(String(heuresParam).replace(',', '.')) : HEURES_HYGIENE_POEI
  if (!(heures > 0)) {
    return NextResponse.json({ error: 'La durée du module hygiène doit être supérieure à 0 heure' }, { status: 400 })
  }

  const [{ data: orgRow }, { data: poei }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    supabase.from('poei').select('id, numero, date_debut, date_fin').eq('id', poeiId).eq('organization_id', orgId).maybeSingle(),
  ])
  if (!poei) return NextResponse.json({ error: 'Parcours POEI introuvable' }, { status: 404 })

  let q = supabase.from('poei_candidats')
    .select('id, statut, apprenant:apprenants(id, civilite, prenom, nom, date_naissance, entreprise)')
    .eq('poei_id', poeiId).eq('organization_id', orgId)
  if (candidatId) q = q.eq('id', candidatId)
  const { data: candidats } = await q

  const apprenants = (candidats || [])
    .filter((c: any) => c.statut !== 'abandonne' && c.apprenant)
    .map((c: any) => c.apprenant)
    .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
  if (!apprenants.length) {
    return NextResponse.json({ error: 'Aucun candidat actif sur ce parcours' }, { status: 404 })
  }

  const heuresParApprenant: Record<string, number> = {}
  for (const a of apprenants) heuresParApprenant[a.id] = heures

  const org = await withDocumentLogo(supabase, orgRow)
  const buffer = await renderToBuffer(
    createElement(AttestationHygienePDF, {
      apprenants,
      session: { reference: (poei as any).numero, date_debut: (poei as any).date_debut, date_fin: (poei as any).date_fin } as any,
      formation: { intitule: INTITULE_MODULE_HYGIENE, duree_heures: heures },
      org, heuresParApprenant,
    }) as any,
  )

  const nom = candidatId && apprenants[0]
    ? `Attestation hygiene - ${apprenants[0].nom} ${apprenants[0].prenom}`
    : `Attestations hygiene - ${(poei as any).numero || 'POEI'}`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_')}.pdf"`,
    },
  })
}
