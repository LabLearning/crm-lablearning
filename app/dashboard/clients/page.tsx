import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ClientsList } from './ClientsList'
import type { Client } from '@/lib/types/crm'

// Rôles qui voient TOUS les clients de l'organisation
const MANAGER_ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial', 'comptable']

export default async function ClientsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const role = session.user.role
  const canAssign = MANAGER_ROLES.includes(role)

  let clientsQuery = supabase
    .from('clients')
    .select('*')
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })

  // Commercial : ne voit que les clients qui lui sont assignés
  if (role === 'commercial') {
    clientsQuery = clientsQuery.eq('assigned_to', session.user.id)
  }

  // Apporteur d'affaires : uniquement les clients liés à ses leads
  if (session.user.role === 'apporteur_affaires') {
    const { data: apporteurRecord } = await supabase
      .from('apporteurs_affaires')
      .select('id')
      .eq('user_id', session.user.id)
      .single()
    if (apporteurRecord) {
      const { data: leadsWithClient } = await supabase
        .from('leads')
        .select('client_id')
        .eq('apporteur_id', apporteurRecord.id)
        .not('client_id', 'is', null)
      const clientIds = (leadsWithClient || []).map((l: any) => l.client_id).filter(Boolean)
      if (clientIds.length > 0) {
        clientsQuery = clientsQuery.in('id', clientIds)
      } else {
        clientsQuery = clientsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
      }
    }
  }

  // Liste des utilisateurs (pour l'assignation) + résolution des noms — uniquement pour les managers
  const usersPromise = canAssign
    ? supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('organization_id', session.organization.id)
        .eq('status', 'active')
        .order('first_name')
    : Promise.resolve({ data: [] as any[] })

  const [{ data: clients }, { data: users }] = await Promise.all([clientsQuery, usersPromise])

  // Attache le nom de l'assigné pour l'affichage
  const userMap = new Map((users || []).map((u: any) => [u.id, u]))
  const clientsWithAssignee = (clients || []).map((c: any) => ({
    ...c,
    assigned_user: c.assigned_to && userMap.has(c.assigned_to)
      ? { first_name: userMap.get(c.assigned_to).first_name, last_name: userMap.get(c.assigned_to).last_name }
      : null,
  }))

  return (
    <div className="animate-fade-in">
      <ClientsList
        clients={clientsWithAssignee as Client[]}
        users={(users || []) as any[]}
        canAssign={canAssign}
      />
    </div>
  )
}
