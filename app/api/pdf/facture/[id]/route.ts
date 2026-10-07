import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { heuresFacturables, periodeCandidat } from '@/lib/poei-candidat'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import type { Facture } from '@/lib/types/facture'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()
  // Contrôle d'org : la facture doit appartenir à l'organisation de l'appelant
  // (empêche le téléchargement inter-organisations en devinant un UUID).
  const { data: facture, error } = await supabase
    .from('factures')
    .select(`
      *,
      client:clients(raison_sociale, nom, prenom, type, email, adresse, code_postal, ville, siret, tva_intra),
      lignes:facture_lignes(*),
      paiements(*)
    `)
    .eq('id', params.id)
    .eq('organization_id', auth.user.organizationId)
    .single()

  if (error || !facture) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  }

  const { data: orgRaw } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', (facture as any).organization_id)
    .single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Destinataire : agence France Travail (POEI) ou OPCO (session financée).
  // Dans les deux cas l'entreprise apparaît en « pour le compte de ».
  let agence: any = null
  if ((facture as any).agence_ft_id) {
    const { data: ag } = await supabase.from('agences_france_travail')
      .select('*').eq('id', (facture as any).agence_ft_id).maybeSingle()
    agence = ag || null
  } else if ((facture as any).financeur_type === 'opco' && (facture as any).session_id) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('opco_id, client:client_id(opco_id)')
      .eq('id', (facture as any).session_id)
      .maybeSingle()
    const opcoId = (sess as any)?.opco_id || (sess as any)?.client?.opco_id
    if (opcoId) {
      const { data: o } = await supabase.from('opco')
        .select('nom, adresse, code_postal, ville, siret, tva_intra').eq('id', opcoId).maybeSingle()
      agence = o || null
    }
  }

  // Détail de l'action de formation : le financeur en a besoin pour rapprocher
  // la facture de son dossier (référence, participant, dates, n° d'engagement).
  const detail: { label: string; valeur: string }[] = []
  const marker = String((facture as any).notes_internes || '').match(/\[POEI-FACT:([0-9a-f-]+):([0-9a-f-]+)\]/i)
  if (marker) {
    const CHAMPS_POEI = 'numero, duree_heures, date_debut, date_fin, session:session_id(reference, adresse, code_postal, ville, lieu), client:client_id(raison_sociale, adresse, code_postal, ville)'
    const { data: poei } = await supabase.from('poei').select(CHAMPS_POEI).eq('id', marker[1]).maybeSingle()
    const { data: cand } = await supabase
      .from('poei_candidats')
      .select('numero_engagement, numero_convention, date_debut, date_fin, duree_heures, statut, date_abandon, heures_effectuees, apprenant:apprenant_id(prenom, nom)')
      .eq('id', marker[2])
      .maybeSingle()

    const p: any = poei || {}
    const fr = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
    const participant = cand
      ? `${(cand as any).apprenant?.prenom || ''} ${(cand as any).apprenant?.nom || ''}`.trim().toUpperCase()
      : ''
    // Dates et durée du candidat : une entrée décalée, un abandon ou des heures
    // effectuées déclarées ne se facturent pas sur le calendrier du projet.
    const periode = cand ? periodeCandidat(cand as any, p) : { debut: p.date_debut, fin: p.date_fin }
    const heures = cand ? heuresFacturables(cand as any, p) : Number(p.duree_heures) || 0
    const jours = heures ? Math.round(heures / 7) : 0
    const lieu = [p.session?.adresse || p.session?.lieu, p.session?.code_postal, p.session?.ville]
      .filter(Boolean).join(', ')
      || [p.client?.adresse, p.client?.code_postal, p.client?.ville].filter(Boolean).join(', ')

    if (p.session?.reference) detail.push({ label: 'Référence', valeur: p.session.reference })
    if (participant) detail.push({ label: 'Participant', valeur: participant })
    if (periode.debut) detail.push({ label: 'Dates', valeur: `du ${fr(periode.debut)} au ${fr(periode.fin)}` })
    if (heures) detail.push({ label: 'Durée', valeur: `${heures}h${jours ? ` (${jours} jours)` : ''}` })
    if (lieu) detail.push({ label: 'Lieu', valeur: lieu })
    // France Travail engage chaque candidat séparément : le numéro est le sien.
    // Celui figé sur la facture prime (elle a pu être émise depuis).
    const engagement = (facture as any).numero_engagement || (cand as any)?.numero_engagement
    if (engagement) detail.push({ label: "N° d'engagement", valeur: String(engagement) })
    const convention = (cand as any)?.numero_convention
    if (convention) detail.push({ label: 'N° de convention', valeur: String(convention) })
  }

  // Facture de session financée : même bloc de détail que les factures OPCO
  // reprises de Dendreo (type, référence, participants, dates, durée, lieu,
  // numéro de dossier).
  const marqueurSession = String((facture as any).notes_internes || '').match(/\[SESSION-FACT:([0-9a-f-]+)\]/i)
  if (marqueurSession) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('reference, type_session, date_debut, date_fin, lieu, adresse, code_postal, ville, numero_dossier_opco, formation:formation_id(duree_heures), client:client_id(raison_sociale, adresse, code_postal, ville)')
      .eq('id', marqueurSession[1])
      .maybeSingle()
    const { data: inscrits } = await supabase
      .from('inscriptions')
      .select('apprenant:apprenants(prenom, nom)')
      .eq('session_id', marqueurSession[1])
      .not('status', 'in', '("annule","abandonne")')

    const se: any = sess || {}
    const frd = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '')
    const heures = Number(se.formation?.duree_heures) || 0
    const jours = heures ? Math.round(heures / 7) : 0
    const noms = (inscrits || [])
      .map((i: any) => `${i.apprenant?.nom || ''} ${i.apprenant?.prenom || ''}`.trim())
      .filter(Boolean)
    const lieuSession = /\b\d{5}\b/.test(String(se.lieu || ''))
      ? se.lieu
      : [se.lieu, se.adresse || se.client?.adresse, [se.code_postal || se.client?.code_postal, se.ville || se.client?.ville].filter(Boolean).join(' ')]
          .filter(Boolean).join(', ')

    if (se.reference) detail.push({ label: 'Référence', valeur: se.reference })
    if (noms.length) detail.push({ label: `${noms.length} participant${noms.length > 1 ? 's' : ''}`, valeur: noms.join(', ') })
    if (se.date_debut) {
      detail.push({
        label: 'Dates',
        valeur: se.date_fin && se.date_fin !== se.date_debut ? `du ${frd(se.date_debut)} au ${frd(se.date_fin)}` : `le ${frd(se.date_debut)}`,
      })
    }
    if (heures) detail.push({ label: 'Durée', valeur: `${heures}h${jours ? ` (${jours} jour${jours > 1 ? 's' : ''})` : ''}` })
    if (lieuSession) detail.push({ label: 'Lieu', valeur: lieuSession })
    if (se.numero_dossier_opco) detail.push({ label: 'Numéro dossier', valeur: se.numero_dossier_opco })
  }

  const buffer = await renderToBuffer(
    createElement(FacturePDF, { facture: facture as Facture, org, agence, detail }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${facture.numero}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
