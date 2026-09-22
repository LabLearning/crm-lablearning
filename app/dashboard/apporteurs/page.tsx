import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { syncCommissionsApporteur } from '@/lib/commission-apporteur'
import { ApporteursList } from './ApporteursList'
import type { ApporteurAffaires } from '@/lib/types/crm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Apporteurs d’affaires — CRM Lab Learning' }

/**
 * Liste des apporteurs avec, pour chacun, ses établissements et l'état de ses
 * commissions. Les lignes en attente sont recalculées à l'ouverture pour que
 * les montants « à verser » reflètent les derniers encaissements.
 */
export default async function ApporteursPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  await syncCommissionsApporteur(supabase, orgId)

  const [{ data: apporteurs }, { data: clients }, { data: commissions }] = await Promise.all([
    supabase.from('apporteurs_affaires').select('*').eq('organization_id', orgId).order('nom', { ascending: true }),
    supabase.from('clients').select('id, apporteur_id').eq('organization_id', orgId).not('apporteur_id', 'is', null),
    supabase.from('commissions').select('id, apporteur_id, client_id, montant_base, montant_commission, status').eq('organization_id', orgId),
  ])

  return (
    <div className="animate-fade-in">
      <ApporteursList
        apporteurs={(apporteurs || []) as ApporteurAffaires[]}
        clients={(clients || []) as any[]}
        commissions={(commissions || []) as any[]}
        peutGerer={['super_admin', 'gestionnaire', 'directeur_commercial', 'comptable'].includes(session.user.role)}
      />
    </div>
  )
}
