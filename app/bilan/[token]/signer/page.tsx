import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { CHAMPS_BILAN_FT, SIGNATURE_BILAN, construireBilanFt, lignesBilanFt } from '@/lib/poei-bilan-ft'
import { BilanSignatureClient } from './BilanSignatureClient'

export const dynamic = 'force-dynamic'

/**
 * Page publique où le stagiaire relit son bilan de fin de formation, donne son
 * avis sur la formation et signe. Accès par lien personnel.
 */
export default async function BilanSignerPage({ params }: { params: { token: string } }) {
  if (!/^[0-9a-f]{64}$/.test(params.token || '')) redirect('/portail/expired')
  const supabase = await createServiceRoleClient()

  const { data: grille } = await supabase.from('poei_grilles')
    .select('id, organization_id, poei_id, apprenant_id, appreciations, avis_final, motivation_avis, apprenant:apprenants(prenom, nom), formateur:formateurs(prenom, nom)')
    .eq(`appreciations->>${SIGNATURE_BILAN.jeton}`, params.token).is('semaine', null).maybeSingle()
  if (!grille) redirect('/portail/expired')
  const g: any = grille
  const a: Record<string, any> = g.appreciations || {}
  const dejaSigne = !!a[SIGNATURE_BILAN.signeLe]
  if (!dejaSigne && a[SIGNATURE_BILAN.expire] && new Date(a[SIGNATURE_BILAN.expire]) < new Date()) redirect('/portail/expired')

  const [{ data: org }, { data: poei }, { data: candidat }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', g.organization_id).single(),
    supabase.from('poei')
      .select('id, numero, poste_vise, date_debut, date_fin, duree_heures, formation:formation_id(intitule, duree_heures, est_certifiante)')
      .eq('id', g.poei_id).eq('organization_id', g.organization_id).single(),
    supabase.from('poei_candidats')
      .select('apprenant_id, statut, date_abandon, motif_abandon, identifiant_ft, poste_vise, type_contrat, date_debut, date_fin, date_embauche_prevue')
      .eq('poei_id', g.poei_id).eq('apprenant_id', g.apprenant_id).maybeSingle(),
  ])
  if (!org || !poei) redirect('/portail/expired')

  const { heuresCertificatsPoei } = await import('@/lib/certificat-heures')
  const h = (await heuresCertificatsPoei(supabase, poei as any, (poei as any).formation?.duree_heures)).get(String(g.apprenant_id))
  const bilan = construireBilanFt({
    org, poei, candidat, apprenant: g.apprenant,
    formateurNom: g.formateur ? `${g.formateur.prenom || ''} ${g.formateur.nom || ''}`.trim() : null,
    heuresReelles: h?.heures ?? null, heuresPrevues: h?.dureeTotale ?? null,
    grille: g, aujourdhui: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }),
  })

  // Page sur fond clair : logo vert (logo_url peut être la variante blanche des emails)
  const { resolveDocumentLogoUrl } = await import('@/lib/pdf/org-logo')
  const logo = await resolveDocumentLogoUrl(supabase, org as any)

  return (
    <div className="min-h-screen bg-surface-50">
      <BilanSignatureClient
        token={params.token}
        orgNom={(org as any).name || 'Lab Learning'}
        logo={logo || null}
        nomStagiaire={`${g.apprenant?.prenom || ''} ${g.apprenant?.nom || ''}`.trim()}
        lignes={lignesBilanFt(bilan)}
        avisInitial={String(a[CHAMPS_BILAN_FT.avisStagiaire] || '')}
        dejaSigne={dejaSigne}
      />
    </div>
  )
}
