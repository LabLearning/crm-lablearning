import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ReclamationsList } from './ReclamationsList'
import type { Reclamation, ActionAmelioration } from '@/lib/types/qualiopi'

export default async function ReclamationsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: reclamations }, { data: actions }, { data: users }] = await Promise.all([
    supabase
      .from('reclamations')
      .select('*, responsable:users!reclamations_responsable_id_fkey(first_name, last_name)')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('actions_amelioration')
      .select('*, responsable:users!actions_amelioration_responsable_id_fkey(first_name, last_name)')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('organization_id', session.organization.id)
      .eq('status', 'active'),
  ])

  return (
    <div className="animate-fade-in">
      <ReclamationsList
        reclamations={(reclamations || []) as Reclamation[]}
        actions={(actions || []) as ActionAmelioration[]}
        users={users || []}
      />
    </div>
  )
}
