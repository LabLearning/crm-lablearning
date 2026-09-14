import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { zipSync } from 'fflate'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { periodeCandidat } from '@/lib/poei-candidat'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import type { Facture } from '@/lib/types/facture'

function safeName(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-') || 'candidat'
}

/**
 * Toutes les factures d'un projet POEI dans un seul ZIP, une par candidat.
 * Chaque PDF est généré comme la facture unitaire : même bloc de détail
 * (participant, dates, durée, n° d'engagement, n° de convention).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, organization_id, duree_heures, date_debut, date_fin, session:session_id(reference, adresse, code_postal, ville, lieu), client:client_id(raison_sociale, adresse, code_postal, ville)')
    .eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!poei) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  const { data: factures } = await supabase
    .from('factures')
    .select('*, client:clients(raison_sociale, nom, prenom, type, email, adresse, code_postal, ville, siret, tva_intra), lignes:facture_lignes(*), paiements(*)')
    .eq('organization_id', poei.organization_id)
    .ilike('notes_internes', `%[POEI-FACT:${params.id}:%`)
    .order('numero')
  if (!factures || factures.length === 0) {
    return NextResponse.json({ error: "Aucune facture à télécharger. Générez d'abord les factures." }, { status: 404 })
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', poei.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Candidats du dossier : nom du participant et références France Travail
  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('*, apprenant:apprenant_id(prenom, nom)')
    .eq('poei_id', params.id)
  const parCandidat = new Map((candidats || []).map((c: any) => [c.id, c]))

  const agenceIds = [...new Set((factures as any[]).map((f) => f.agence_ft_id).filter(Boolean))]
  const agences = new Map<string, any>()
  if (agenceIds.length > 0) {
    const { data: ags } = await supabase.from('agences_france_travail').select('*').in('id', agenceIds)
    for (const a of ags || []) agences.set(a.id, a)
  }

  const p: any = poei
  const fr = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

  const lieu = [p.session?.adresse || p.session?.lieu, p.session?.code_postal, p.session?.ville].filter(Boolean).join(', ')
    || [p.client?.adresse, p.client?.code_postal, p.client?.ville].filter(Boolean).join(', ')

  const files: Record<string, Uint8Array> = {}
  const usedNames = new Set<string>()

  for (const facture of factures as any[]) {
    const m = String(facture.notes_internes || '').match(/\[POEI-FACT:[0-9a-f-]+:([0-9a-f-]+)\]/i)
    const cand: any = m ? parCandidat.get(m[1]) : null
    const participant = cand
      ? `${cand.apprenant?.prenom || ''} ${cand.apprenant?.nom || ''}`.trim().toUpperCase()
      : ''

    const detail: { label: string; valeur: string }[] = [{ label: 'Type', valeur: 'INTER' }]
    if (p.session?.reference) detail.push({ label: 'Référence', valeur: p.session.reference })
    if (participant) detail.push({ label: 'Participant', valeur: participant })
    // Dates et durée du candidat : une entrée décalée ou un abandon ne se
    // facture pas sur le calendrier du projet.
    const periode = cand ? periodeCandidat(cand, p) : { debut: p.date_debut, fin: p.date_fin, heures: Number(p.duree_heures) || 0 }
    const heures = Number(periode.heures) || 0
    const jours = heures ? Math.round(heures / 7) : 0
    if (periode.debut) detail.push({ label: 'Dates', valeur: `du ${fr(periode.debut)} au ${fr(periode.fin)}` })
    if (heures) detail.push({ label: 'Durée', valeur: `${heures}h${jours ? ` (${jours} jours)` : ''}` })
    if (lieu) detail.push({ label: 'Lieu', valeur: lieu })
    const engagement = facture.numero_engagement || cand?.numero_engagement
    if (engagement) detail.push({ label: "N° d'engagement", valeur: String(engagement) })
    if (cand?.numero_convention) detail.push({ label: 'N° de convention', valeur: String(cand.numero_convention) })

    const buffer = await renderToBuffer(
      createElement(FacturePDF, {
        facture: facture as Facture,
        org,
        agence: facture.agence_ft_id ? agences.get(facture.agence_ft_id) : null,
        detail,
      }) as any,
    )

    const base = `Facture - ${safeName(participant || 'candidat')} - ${facture.numero}`
    let name = `${base}.pdf`
    let n = 2
    while (usedNames.has(name)) name = `${base}-${n++}.pdf`
    usedNames.add(name)
    files[name] = new Uint8Array(buffer)
  }

  const zipped = zipSync(files, { level: 0 })
  const zipName = `Factures POEI - ${safeName((poei as any).client?.raison_sociale || poei.numero || 'projet')}.zip`

  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
