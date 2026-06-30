import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isAdmin as checkAdmin, isSuperAdmin as checkSuperAdmin } from '@/lib/permissions'
import { UsersList } from './UsersList'
import type { User } from '@/lib/types'

export default async function UsersPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: users }, { data: invitations }, { data: franchises }] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', session.organization.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    // Franchises pour rattacher un compte franchiseur
    supabase
      .from('franchises')
      .select('id, nom, raison_sociale')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('nom'),
  ])

  return (
    <div className="animate-fade-in">
      <UsersList
        users={(users || []) as User[]}
        invitations={(invitations || []) as any[]}
        franchises={(franchises || []) as any[]}
        currentUserId={session.user.id}
        isAdmin={checkAdmin(session.user.role)}
        isSuperAdmin={checkSuperAdmin(session.user.role)}
      />
    </div>
  )
}
