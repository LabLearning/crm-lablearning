import { createServiceRoleClient } from '@/lib/supabase/server'
import { ConventionSignatureClient } from './ConventionSignatureClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ConventionSignaturePage({ params }: { params: { token: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: conv } = await supabase
    .from('conventions')
    .select(`
      id, organization_id, numero, type, objet, nombre_stagiaires, duree_heures, lieu, dates_formation,
      montant_ht, taux_tva, montant_ttc, status,
      signature_token_expires_at, signature_client_date, signature_client_nom,
      organization:organizations(name, logo_url),
      client:clients(type, raison_sociale, adresse, code_postal, ville, siret),
      formation:formation_id(intitule)
    `)
    .eq('signature_token', params.token)
    .maybeSingle()

  if (!conv) redirect('/portail/expired')
  if (conv.signature_token_expires_at && new Date(conv.signature_token_expires_at) < new Date()) {
    redirect('/portail/expired')
  }

  // Preuve : ouverture du lien par le signataire, avant sa signature
  if (!['signee_client', 'signee_complete'].includes((conv as any).status)) {
    const { origineRequete, journaliserEvenementConvention } = await import('@/lib/preuve-signature-convention')
    const origine = await origineRequete()
    await journaliserEvenementConvention(supabase, {
      organizationId: (conv as any).organization_id, conventionId: (conv as any).id, evenement: 'lien_ouvert',
      ip: origine.ip, userAgent: origine.userAgent,
    })
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <ConventionSignatureClient convention={conv as any} token={params.token} />
    </div>
  )
}
