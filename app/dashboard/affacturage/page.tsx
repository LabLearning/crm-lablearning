import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import AffacturageClient from './AffacturageClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Affacturage — CRM Lab Learning' }

export default async function AffacturagePage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [cessionsRes, factorsRes] = await Promise.all([
    supabase
      .from('cessions_creances')
      .select(`
        id, reference, reference_factor, montant_cede, taux_commission, montant_commission,
        taux_retenue, montant_retenue, montant_avance, date_cession, date_avance, date_soldee,
        status, notes, created_at,
        facture:factures(id, numero, montant_ttc, status, dossier_id,
          client:clients(raison_sociale)),
        affactureur:affactureurs(id, raison_sociale)
      `)
      .eq('organization_id', orgId)
      .order('date_cession', { ascending: false }),
    supabase
      .from('affactureurs')
      .select('*')
      .eq('organization_id', orgId)
      .order('raison_sociale'),
  ])

  return (
    <AffacturageClient
      cessions={(cessionsRes.data || []) as any[]}
      affactureurs={(factorsRes.data || []) as any[]}
    />
  )
}
