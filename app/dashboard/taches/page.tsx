import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TachesBoard from './TachesBoard'
import { filtrerTachesVisibles } from '@/lib/taches-visibilite'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tâches — CRM Lab Learning' }

// Espace interne : réservé à l'équipe (admin / gestionnaire / commercial).
const TACHES_ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial']

export default async function TachesPage() {
  const session = await getSession()
  if (!TACHES_ROLES.includes(session.user.role)) redirect('/dashboard')
  const supabase = await createServiceRoleClient()

  const [tachesRes, usersRes] = await Promise.all([
    supabase
      .from('crm_taches')
      .select(
        `id, titre, description, status, priorite, assignee_id, created_by, due_date,
         position, labels, entity_type, entity_id, entity_label, completed_at, created_at,
         assignee:users!crm_taches_assignee_id_fkey(id, first_name, last_name, email, role),
         author:users!crm_taches_created_by_fkey(id, first_name, last_name, email)`,
      )
      .eq('organization_id', session.organization.id)
      .is('archived_at', null)
      .order('status')
      .order('position'),
    // Seule l'équipe interne peut se voir assigner une tâche : les formateurs,
    // apporteurs, franchisés et apprenants n'ont pas accès à ce module.
    supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .eq('organization_id', session.organization.id)
      .eq('status', 'active')
      .in('role', ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial'])
      .order('first_name'),
  ])

  // Les tâches d'admin à admin ne sont montrées qu'aux admins (lib/taches-visibilite)
  const taches = await filtrerTachesVisibles(supabase, session.organization.id, { id: session.user.id, role: session.user.role }, (tachesRes.data || []) as any[])

  return (
    <TachesBoard
      taches={taches}
      users={(usersRes.data || []) as any[]}
      currentUserId={session.user.id}
    />
  )
}
