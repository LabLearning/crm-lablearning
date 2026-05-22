import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import FranchisesClient from './FranchisesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Franchises — CRM Lab Learning' }

export default async function FranchisesPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: franchises } = await supabase
    .from('franchises')
    .select('id, nom, raison_sociale, secteur, nombre_etablissements, objectif_annuel_ca, commission_type, taux_commission, logo_url, is_active')
    .eq('organization_id', orgId)
    .order('nom')

  const franchiseIds = (franchises || []).map((f) => f.id)

  const { data: clients } = franchiseIds.length
    ? await supabase.from('clients').select('id, franchise_id').in('franchise_id', franchiseIds)
    : { data: [] as any[] }

  const { data: dossiers } = franchiseIds.length
    ? await supabase
        .from('dossiers_formation')
        .select('id, franchise_id, montant_total_ttc, commission_montant, commission_status')
        .in('franchise_id', franchiseIds)
    : { data: [] as any[] }

  return (
    <FranchisesClient
      franchises={(franchises || []) as any[]}
      clients={(clients || []) as any[]}
      dossiers={(dossiers || []) as any[]}
    />
  )
}
