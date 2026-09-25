import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MandatSignatureClient } from './MandatSignatureClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Signature du mandat POEI — Lab Learning' }

/**
 * Signature publique (par token) du mandat POEI par le gérant de
 * l'entreprise mandante. Le lien arrive par email ; le gérant lit le
 * mandat complet (PDF) puis signe dans le cadre.
 */
export default async function MandatSignerPage({ params }: { params: { token: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: mandat } = await supabase
    .from('poei_mandats')
    .select(`
      id, token, token_expires_at, signed_at, date_emission, email,
      poei:poei(id, numero, date_debut, date_fin, client_id,
        formation:formation_id(intitule),
        client:client_id(raison_sociale, nom_commercial)),
      organization:organizations(id, name, logo_url)
    `)
    .eq('token', params.token)
    .maybeSingle()

  if (!mandat) redirect('/portail/expired')
  if (mandat.token_expires_at && new Date(mandat.token_expires_at) < new Date()) redirect('/portail/expired')

  // Le gérant = contact référent de la fiche client, source unique.
  let gerantNom: string | null = null
  const clientId = (mandat as any).poei?.client_id
  if (clientId) {
    const { data: contacts } = await supabase
      .from('contacts').select('prenom, nom, est_signataire, est_principal').eq('client_id', clientId)
    const c = (contacts || []).find((x: any) => x.est_signataire)
      || (contacts || []).find((x: any) => x.est_principal)
      || (contacts || [])[0]
    if (c) gerantNom = [c.prenom, c.nom].filter(Boolean).join(' ').trim() || null
  }

  const { count: nbCandidats } = await supabase
    .from('poei_candidats').select('id', { count: 'exact', head: true }).eq('poei_id', (mandat as any).poei?.id)

  // Page sur fond clair : logo vert (logo_url peut être la variante blanche des emails)
  if ((mandat as any).organization) {
    const { resolveDocumentLogoUrl } = await import('@/lib/pdf/org-logo')
    ;(mandat as any).organization.logo_url = await resolveDocumentLogoUrl(supabase, (mandat as any).organization)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <MandatSignatureClient mandat={mandat as any} token={params.token} gerantNom={gerantNom} nbCandidats={nbCandidats || 0} />
    </div>
  )
}
