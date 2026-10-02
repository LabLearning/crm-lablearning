import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SIGNATURE_BILAN } from '@/lib/poei-bilan-ft'
import { bilanPourSignature } from '@/lib/poei-signature-documents'
import { BilanSignatureClient } from './BilanSignatureClient'

export const dynamic = 'force-dynamic'

/**
 * Page publique où le stagiaire relit son bilan de fin de formation, donne son
 * avis sur la formation et signe. Accès par lien personnel. S'il n'a pas
 * encore signé son certificat de réalisation, la même signature le couvre.
 */
export default async function BilanSignerPage({ params }: { params: { token: string } }) {
  if (!/^[0-9a-f]{64}$/.test(params.token || '')) redirect('/portail/expired')
  const supabase = await createServiceRoleClient()

  const { data: grille } = await supabase.from('poei_grilles')
    .select('id, organization_id, poei_id, apprenant_id, appreciations, apprenant:apprenants(prenom, nom)')
    .eq(`appreciations->>${SIGNATURE_BILAN.jeton}`, params.token).is('semaine', null).maybeSingle()
  if (!grille) redirect('/portail/expired')
  const g: any = grille
  const a: Record<string, any> = g.appreciations || {}
  const dejaSigne = !!a[SIGNATURE_BILAN.signeLe]
  if (!dejaSigne && a[SIGNATURE_BILAN.expire] && new Date(a[SIGNATURE_BILAN.expire]) < new Date()) redirect('/portail/expired')

  const [bilan, { data: org }, { data: certificat }] = await Promise.all([
    bilanPourSignature(supabase, g.organization_id, g.poei_id, g.apprenant_id),
    supabase.from('organizations').select('id, name, logo_url').eq('id', g.organization_id).single(),
    supabase.from('certificat_signatures').select('signed_at')
      .eq('organization_id', g.organization_id).eq('poei_id', g.poei_id).eq('apprenant_id', g.apprenant_id).maybeSingle(),
  ])
  if (!bilan || !org) redirect('/portail/expired')

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
        lignes={bilan!.lignes}
        avisInitial={bilan!.avisInitial}
        noteInitiale={bilan!.noteInitiale}
        dejaSigne={dejaSigne}
        certificatASigner={!certificat?.signed_at}
      />
    </div>
  )
}
