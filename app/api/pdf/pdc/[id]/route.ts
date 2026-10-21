import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { fillPdc } from '@/lib/pdf/fill-pdc'
import { donneesPlanDeveloppement, LecturePdcImpossible } from '@/lib/poei-pdc'

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/**
 * Plan de développement de compétences d'un candidat POEI : le formulaire
 * France Travail rempli comme le plan NSLENS fait à la main (septembre 2026).
 * Employeur, responsable et tuteur : le contact du client ; tableau : la part du
 * programme de la formation que suit le candidat (lib/poei-pdc).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  // Le plan porte les coordonnées de l'employeur et du stagiaire : droits du module POEI
  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', auth.user.organizationId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/poei', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  // Le formulaire officiel se charge pendant la lecture des données
  const modele = fetch(new URL('/templates/pdc-france-travail.pdf', req.url))
    .then(async (r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)

  let pdc: Awaited<ReturnType<typeof donneesPlanDeveloppement>>
  try {
    // Contrôle d'org : le candidat POEI doit appartenir à l'organisation de l'appelant
    pdc = await donneesPlanDeveloppement(supabase, auth.user.organizationId, params.id)
  } catch (e) {
    if (e instanceof LecturePdcImpossible) {
      console.error('[plan de développement]', e.message)
      return NextResponse.json({ error: 'Lecture des données impossible : le plan n’a pas été produit. Réessayez dans un instant.' }, { status: 503 })
    }
    throw e
  }
  if (!pdc) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })

  // Un tableau qui ne couvre pas la durée annoncée ne part pas à France Travail
  const court = pdc.alertes.find((a) => a.code === 'programme_court')
  if (court) {
    return new NextResponse(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plan de développement à compléter</title></head>
      <body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:600px;margin:60px auto;padding:0 20px;color:#1C1917">
      <h1 style="font-size:20px">Plan de développement de compétences non produit</h1>
      <p style="color:#57534E;font-size:14px;line-height:1.6">${echapper(court.message)}</p>
      <p style="color:#57534E;font-size:14px;line-height:1.6">Le tableau du formulaire doit décrire toutes les heures annoncées en en-tête. Corrigez la fiche POEI, puis relancez le téléchargement.</p>
      </body></html>`,
      { status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const tpl = await modele
  if (!tpl) return NextResponse.json({ error: 'Formulaire France Travail introuvable' }, { status: 500 })
  const pdf = await fillPdc(tpl, pdc.data)

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdc.fichier}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
