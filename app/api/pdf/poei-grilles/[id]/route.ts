import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { zipSync } from 'fflate'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { GrillePoeiPDF } from '@/lib/pdf/grille-poei-pdf'
import { GRILLE_SECTIONS, APPRECIATIONS } from '@/lib/poei-grille'

export const dynamic = 'force-dynamic'

const safeName = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'document'

/**
 * Grilles d'évaluation POEI en PDF. `id` = POEI.
 * Sans paramètre  → ZIP de toutes les grilles.
 * ?apprenant=…&semaine=…  → une seule grille (semaine vide = évaluation finale).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const supabase = await createServiceRoleClient()
  const orgId = auth.user.organizationId

  const { data: poei } = await supabase
    .from('poei')
    .select('id, numero, poste_vise, date_debut, date_fin, duree_heures, numero_engagement, numero_dossier_ft, client_id, client:client_id(raison_sociale, nom_commercial), formation:formation_id(intitule)')
    .eq('id', params.id).eq('organization_id', orgId).single()
  if (!poei) return NextResponse.json({ error: 'Projet POEI introuvable' }, { status: 404 })

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()

  // Signatures déjà recueillies dans la POEI : celle du bénéficiaire sur son
  // certificat de réalisation, celle du formateur référent sur son contrat de
  // prestation. L'employeur n'en a pas en base.
  const [{ data: sigsCertif }, { data: interventions }, { data: candidatsConv }] = await Promise.all([
    supabase.from('certificat_signatures')
      .select('apprenant_id, signature_data, signataire_nom, signed_at, date_signature, role')
      .eq('poei_id', params.id).not('signed_at', 'is', null),
    supabase.from('poei_interventions')
      .select('formateur_id, contrat:contrats_formateur(signature_formateur_date, signature_formateur_nom, signature_formateur_signature_data)')
      .eq('poei_id', params.id),
    supabase.from('poei_candidats')
      .select('apprenant_id, numero_convention, numero_engagement')
      .eq('poei_id', params.id),
  ])
  const sigBenefPar = new Map((sigsCertif || [])
    .filter((x: any) => (x.role || 'candidat') === 'candidat')
    .map((x: any) => [String(x.apprenant_id), x]))
  const sigEmployeur = (sigsCertif || []).find((x: any) => x.role === 'employeur') || null
  const conventionPar = new Map((candidatsConv || []).map((x: any) => [String(x.apprenant_id), x]))
  const sigTuteurPar = new Map(
    (interventions || []).map((i: any) => {
      const c = Array.isArray(i.contrat) ? i.contrat[0] : i.contrat
      return [String(i.formateur_id), c?.signature_formateur_signature_data ? {
        data: c.signature_formateur_signature_data,
        nom: c.signature_formateur_nom,
        date: c.signature_formateur_date,
      } : null]
    }),
  )

  // Le signataire de l'attestation : le contact de l'établissement employeur.
  let representantEmployeur: string | null = null
  if ((poei as any)?.client_id) {
    const { data: contacts } = await supabase
      .from('contacts').select('prenom, nom, est_signataire, est_principal')
      .eq('client_id', (poei as any).client_id)
    const c = (contacts || []).find((x: any) => x.est_signataire)
      || (contacts || []).find((x: any) => x.est_principal)
      || (contacts || [])[0]
    if (c) representantEmployeur = [c.prenom, c.nom].filter(Boolean).join(' ').trim() || null
  }
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const apprenantFiltre = req.nextUrl.searchParams.get('apprenant')
  const semaineParam = req.nextUrl.searchParams.get('semaine')

  let q = supabase
    .from('poei_grilles')
    .select('*, apprenant:apprenants(prenom, nom), formateur:formateurs(prenom, nom)')
    .eq('poei_id', params.id).eq('organization_id', orgId)
  if (apprenantFiltre) q = q.eq('apprenant_id', apprenantFiltre)
  if (semaineParam !== null) q = semaineParam === '' ? q.is('semaine', null) : q.eq('semaine', Number(semaineParam))
  const { data: grilles } = await q.order('semaine', { ascending: true, nullsFirst: false })

  if (!grilles || grilles.length === 0) {
    return NextResponse.json({ error: 'Aucun bilan à télécharger' }, { status: 404 })
  }

  const meta = APPRECIATIONS.map((a) => ({ key: a.key, label: a.label }))
  const render = (g: any) => renderToBuffer(
    createElement(GrillePoeiPDF, {
      org, poei,
      representantEmployeur,
      conventionNumero: conventionPar.get(String(g.apprenant_id))?.numero_convention
        || conventionPar.get(String(g.apprenant_id))?.numero_engagement || null,
      signatures: {
        beneficiaire: (() => {
          const x = sigBenefPar.get(String(g.apprenant_id))
          return x ? { data: x.signature_data, nom: x.signataire_nom, date: x.date_signature || x.signed_at } : null
        })(),
        tuteur: sigTuteurPar.get(String(g.formateur_id)) || [...sigTuteurPar.values()].find(Boolean) || null,
        employeur: sigEmployeur ? {
          data: sigEmployeur.signature_data,
          nom: sigEmployeur.signataire_nom,
          date: sigEmployeur.date_signature || sigEmployeur.signed_at,
        } : null,
      },
      apprenant: g.apprenant,
      formateurNom: g.formateur ? `${g.formateur.prenom || ''} ${g.formateur.nom || ''}`.trim() : null,
      semaine: g.semaine,
      sections: GRILLE_SECTIONS,
      items: g.items || {},
      appreciations: g.appreciations || {},
      appreciationsMeta: meta,
      pointsForts: g.points_forts, aRenforcer: g.a_renforcer, recommandations: g.recommandations,
      avisFinal: g.avis_final, motivationAvis: g.motivation_avis, conclusion: g.conclusion,
      dureeRealisee: g.duree_realisee, absences: g.absences,
      dateEvaluation: g.date_evaluation, statut: g.statut,
    }) as any,
  )

  const nomDe = (g: any) => safeName(`${g.apprenant?.prenom || ''} ${g.apprenant?.nom || ''}`)
  const libelle = (g: any) => (g.semaine == null ? 'bilan final' : `semaine ${g.semaine}`)

  // Une seule grille → PDF direct
  if (grilles.length === 1) {
    const g = grilles[0]
    const buffer = await render(g)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bilan - ${nomDe(g)} - ${libelle(g)}.pdf"`,
        'Cache-Control': 'private, max-age=0',
      },
    })
  }

  // Plusieurs → ZIP
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const g of grilles) {
    const buffer = await render(g)
    let base = `Bilan - ${nomDe(g)} - ${libelle(g)}`
    let name = `${base}.pdf`
    let n = 2
    while (used.has(name)) name = `${base} (${n++}).pdf`
    used.add(name)
    files[name] = new Uint8Array(buffer)
  }
  const zipped = zipSync(files, { level: 0 })
  const zipName = `Evaluations POEI - ${safeName((poei as any).client?.nom_commercial || (poei as any).client?.raison_sociale || poei.numero || 'projet')}.zip`
  return new NextResponse(new Uint8Array(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
