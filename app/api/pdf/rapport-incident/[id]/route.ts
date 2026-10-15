import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { RapportIncidentPDF } from '@/lib/pdf/rapport-france-travail-pdf'
import { ROLES_INCIDENTS_POEI, referenceRapport } from '@/lib/rapport-france-travail'
import { LectureRapportImpossible, chargerDossierRapport, chargerPersonneRapport, incidentsEnRapport, nomFichierRapport } from '@/lib/rapport-france-travail-serveur'

/**
 * Rapport d'incident d'un dossier POEI, à transmettre à France Travail.
 * [id] = l'incident. Réservé à l'équipe qui gère les POEI : le formateur
 * déclare l'incident depuis son espace, il ne produit pas le rapport.
 * Chaque tirage est journalisé : le document part chez un tiers.
 */
export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    return await produire(req, ctx)
  } catch (e) {
    if (e instanceof LectureRapportImpossible) return NextResponse.json({ error: 'Lecture du dossier impossible : rapport non produit, réessayez' }, { status: 500 })
    throw e
  }
}

/** Un HEAD (« curl -I ») ne tire pas de rapport : sans corps délivré, il écrirait quand même la ligne au journal. */
export async function HEAD() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'GET' } })
}

async function produire(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()

  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', orgId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/poei', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }
  // Qui tire le rapport doit pouvoir corriger l'incident que la relecture lui signale
  if (!ROLES_INCIDENTS_POEI.includes(auth.user.role)) {
    return NextResponse.json({ error: 'Ce rapport est produit par l’équipe qui traite les incidents du dossier' }, { status: 403 })
  }

  const { data: incident } = await supabase.from('incidents').select('*')
    .eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!incident) return NextResponse.json({ error: 'Incident introuvable' }, { status: 404 })
  if (!incident.poei_id) {
    return NextResponse.json({ error: 'Ce rapport ne concerne que les incidents d’un dossier POEI' }, { status: 400 })
  }

  const base = await chargerDossierRapport(supabase, orgId, incident.poei_id)
  if (!base) return NextResponse.json({ error: 'Dossier POEI introuvable' }, { status: 404 })

  const { data: orgRaw, error: eOrg } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  // Sans l'organisme, le rapport sortirait sans émetteur
  if (eOrg || !orgRaw) return NextResponse.json({ error: 'Lecture du dossier impossible : rapport non produit, réessayez' }, { status: 500 })
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const [stagiaire, rapports] = await Promise.all([
    incident.apprenant_id ? chargerPersonneRapport(supabase, orgId, incident.poei_id, incident.apprenant_id) : Promise.resolve(null),
    incidentsEnRapport(supabase, orgId, [incident], orgRaw.name),
  ])

  const reference = referenceRapport('RI', incident.id, incident.date_incident)
  const buffer = await renderToBuffer(
    createElement(RapportIncidentPDF, {
      org, agence: base.agence, dossier: base.dossier, reference,
      incident: rapports[0],
      personne: stagiaire?.personne || null,
    }) as any,
  )

  // Pas de document chez un tiers sans sa ligne au journal
  const journalise = await logAudit({
    action: 'generer_rapport_france_travail', entity_type: 'incident', entity_id: incident.id,
    details: { reference, poei: incident.poei_id },
  })
  if (!journalise) {
    return NextResponse.json({ error: 'Le tirage n’a pas pu être consigné au journal : rapport non délivré, réessayez' }, { status: 500 })
  }

  const fichier = nomFichierRapport('rapport-incident', base.dossier.numero, stagiaire?.personne.nom, reference)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fichier}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
