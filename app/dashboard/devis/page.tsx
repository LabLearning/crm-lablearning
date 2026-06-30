import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { DevisList } from './DevisList'
import type { Devis } from '@/lib/types/dossier'
import type { Client } from '@/lib/types/crm'
import type { Formation } from '@/lib/types/formation'

export default async function DevisPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: devisList }, { data: clients }, { data: formations }] = await Promise.all([
    supabase
      .from('devis')
      .select(`
        *,
        client:clients(raison_sociale, nom, prenom, type),
        formation:formations(intitule, reference),
        lignes:devis_lignes(*)
      `)
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, raison_sociale, type, nom, prenom')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale'),
    supabase
      .from('formations')
      .select('id, intitule, reference, tarif_inter_ht')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('intitule'),
  ])

  return (
    <div className="animate-fade-in">
      <DevisList
        devisList={(devisList || []) as Devis[]}
        clients={(clients || []) as any[]}
        formations={(formations || []) as any[]}
      />
    </div>
  )
}
