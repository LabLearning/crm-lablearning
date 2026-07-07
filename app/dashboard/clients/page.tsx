import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ClientsList } from './ClientsList'
import type { Client } from '@/lib/types/crm'

// Rôles qui voient TOUS les clients de l'organisation
const MANAGER_ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial', 'comptable']

const PER_PAGE = 50

// Échappe les caractères réservés de la syntaxe .or() de PostgREST
function sanitizeSearch(q: string) {
  return q.replace(/[,()"]/g, ' ').trim()
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; type?: string }
}) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const role = session.user.role
  const canAssign = MANAGER_ROLES.includes(role)

  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const q = sanitizeSearch(searchParams.q || '')
  const typeFilter = ['entreprise', 'particulier'].includes(searchParams.type || '') ? searchParams.type : null
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let clientsQuery = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    clientsQuery = clientsQuery.or(
      `raison_sociale.ilike.%${q}%,nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%`
    )
  }
  if (typeFilter) {
    clientsQuery = clientsQuery.eq('type', typeFilter)
  }

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

  const [{ data: clients, count }, { data: users }] = await Promise.all([clientsQuery, usersPromise])

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
        total={count || 0}
        page={page}
        perPage={PER_PAGE}
        initialSearch={searchParams.q || ''}
        initialType={typeFilter || 'all'}
      />
    </div>
  )
}
