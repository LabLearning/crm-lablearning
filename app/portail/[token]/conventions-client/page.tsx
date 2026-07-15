import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConventionsClient } from './ConventionsClient'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function ClientConventionsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'client') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: conventions } = await supabase
    .from('conventions')
    .select(`
      id, numero, type, status, montant_ht, created_at, signature_client_date,
      formation:formation_id(intitule, duree_heures),
      session:sessions(date_debut, date_fin, lieu)
    `)
    .eq('client_id', context.client.id)
    .order('created_at', { ascending: false })

  const signataireName = context.contact
    ? `${context.contact.prenom} ${context.contact.nom}`
    : (context.client.email || '')

  return (
    <ConventionsClient
      token={params.token}
      conventions={conventions || []}
      signataireName={signataireName}
    />
  )
}
