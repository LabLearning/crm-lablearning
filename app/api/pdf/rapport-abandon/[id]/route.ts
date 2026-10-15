import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { heuresPrevues } from '@/lib/poei-candidat'
import { RapportAbandonPDF } from '@/lib/pdf/rapport-france-travail-pdf'
import { ROLES_RAPPORT_ABANDON, referenceRapport } from '@/lib/rapport-france-travail'
import { LectureRapportImpossible, chargerDossierRapport, chargerPersonneRapport, incidentsEnRapport, nomFichierRapport } from '@/lib/rapport-france-travail-serveur'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Rapport d'abandon d'un candidat POEI, à transmettre à France Travail.
 * [id] = le candidat du dossier (poei_candidats). `?incidents=<id>,<id>` joint
 * les incidents du même stagiaire que le gestionnaire a choisis à l'écran :
 * aucun n'est joint d'office, leur texte est celui du formateur.
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

async function produire(req: Request, { params }: { params: { id: string } }) {
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
  // Qui tire le rapport doit pouvoir en corriger le motif : même équipe que la gestion des candidats
  if (!ROLES_RAPPORT_ABANDON.includes(auth.user.role)) {
    return NextResponse.json({ error: 'Ce rapport est produit par l’équipe qui gère le dossier POEI' }, { status: 403 })
  }

  const { data: candidat } = await supabase.from('poei_candidats').select('*')
    .eq('id', params.id).eq('organization_id', orgId).maybeSingle()
  if (!candidat) return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })
  // Un candidat réintégré garde sa date d'abandon : seul le statut fait foi
  if (candidat.statut !== 'abandonne') {
    return NextResponse.json({ error: 'Aucun abandon n’est déclaré pour ce candidat' }, { status: 400 })
  }
  if (!candidat.apprenant_id) return NextResponse.json({ error: 'Fiche du stagiaire introuvable' }, { status: 404 })

  const base = await chargerDossierRapport(supabase, orgId, candidat.poei_id)
  if (!base) return NextResponse.json({ error: 'Dossier POEI introuvable' }, { status: 404 })
  const stagiaire = await chargerPersonneRapport(supabase, orgId, candidat.poei_id, candidat.apprenant_id, candidat)
  if (!stagiaire) return NextResponse.json({ error: 'Fiche du stagiaire introuvable' }, { status: 404 })

  const { data: orgRaw, error: eOrg } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  // Sans l'organisme, le rapport sortirait sans émetteur
  if (eOrg || !orgRaw) return NextResponse.json({ error: 'Lecture du dossier impossible : rapport non produit, réessayez' }, { status: 500 })
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Incidents joints : seulement ceux demandés, et seulement s'ils sont bien
  // ceux de ce stagiaire sur ce dossier. Le rapport ne sort pas avec moins
  // d'incidents que ceux cochés : l'écran dirait « téléchargé » à tort.
  const brut = (new URL(req.url).searchParams.get('incidents') || '').split(',').map((x) => x.trim()).filter(Boolean)
  const demandes = [...new Set(brut.map((x) => x.toLowerCase()))]
  if (demandes.length > 20 || demandes.some((x) => !UUID.test(x))) {
    return NextResponse.json({ error: 'Liste d’incidents à joindre illisible' }, { status: 400 })
  }
  let joints: any[] = []
  if (demandes.length) {
    const { data, error } = await supabase.from('incidents').select('*')
      .eq('organization_id', orgId).eq('poei_id', candidat.poei_id).eq('apprenant_id', candidat.apprenant_id)
      .in('id', demandes).order('date_incident', { ascending: true })
    if (error) {
      console.error('[rapport abandon] incidents', error)
      return NextResponse.json({ error: 'Lecture des incidents impossible, rapport non produit' }, { status: 500 })
    }
    joints = data || []
    if (joints.length !== demandes.length) {
      return NextResponse.json(
        { error: 'Un incident coché a changé depuis l’ouverture de la fenêtre : rechargez la page et recommencez' },
        { status: 409 },
      )
    }
  }

  const reference = referenceRapport('RA', candidat.id, candidat.date_abandon)
  const prevues = heuresPrevues(candidat as any, base.poei)
  const buffer = await renderToBuffer(
    createElement(RapportAbandonPDF, {
      org, agence: base.agence, dossier: base.dossier, reference,
      personne: stagiaire.personne,
      abandon: {
        // Le candidat entré en cours de parcours a ses propres dates
        dateEntree: candidat.date_debut || base.poei.date_debut || null,
        dateFinPrevue: candidat.date_fin || base.poei.date_fin || null,
        dateAbandon: candidat.date_abandon || null,
        heuresPrevues: prevues,
        heuresEffectuees: candidat.heures_effectuees != null ? Number(candidat.heures_effectuees) : null,
        motif: candidat.motif_abandon || null,
      },
      incidents: await incidentsEnRapport(supabase, orgId, joints, orgRaw.name),
    }) as any,
  )

  // Pas de document chez un tiers sans sa ligne au journal
  const journalise = await logAudit({
    action: 'generer_rapport_france_travail', entity_type: 'poei_candidat', entity_id: candidat.id,
    details: { reference, poei: candidat.poei_id, incidents_joints: joints.length, incidents: joints.map((i) => i.id) },
  })
  if (!journalise) {
    return NextResponse.json({ error: 'Le tirage n’a pas pu être consigné au journal : rapport non délivré, réessayez' }, { status: 500 })
  }

  const fichier = nomFichierRapport('rapport-abandon', base.dossier.numero, stagiaire.personne.nom, stagiaire.personne.prenom)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fichier}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
