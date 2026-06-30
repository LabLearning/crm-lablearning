import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { User, Organization, Permission } from '@/lib/types'

export interface SessionContext {
  user: User
  organization: Organization
  permissions: Permission[]
  impersonatedBy?: User
}

// Mémoïsé par requête (React cache) : si getSession est appelé plusieurs fois
// pendant le même rendu (ex: page + Server Action), une seule exécution réelle.
export const getSession = cache(async function getSession(): Promise<SessionContext> {
  // Anon client for auth (needs cookies)
  const anonClient = await createServerSupabaseClient()
  const { data: { user: authUser } } = await anonClient.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  // Service role client for data (bypasses RLS)
  const supabase = await createServiceRoleClient()

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!user) {
    redirect('/login')
  }

  // organization + permissions sont indépendantes (ne dépendent que de user) → en parallèle
  const [{ data: organization }, { data: permissions }] = await Promise.all([
    supabase
      .from('organizations')
      .select('*')
      .eq('id', user.organization_id)
      .single(),
    supabase
      .from('permissions')
      .select('*')
      .eq('organization_id', user.organization_id)
      .eq('role', user.role),
  ])

  if (!organization) {
    redirect('/login')
  }

  // Check for impersonation cookie (super_admin only)
  const cookieStore = cookies()
  const impersonateCookie = (cookieStore as any).get('ll_impersonate')

  if (impersonateCookie?.value && user.role === 'super_admin') {
    const { data: impersonatedUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', impersonateCookie.value)
      .eq('organization_id', user.organization_id)
      .single()

    if (impersonatedUser) {
      const { data: impersonatedPermissions } = await supabase
        .from('permissions')
        .select('*')
        .eq('organization_id', impersonatedUser.organization_id)
        .eq('role', impersonatedUser.role)

      return {
        user: impersonatedUser as User,
        organization: organization as Organization,
        permissions: (impersonatedPermissions || []) as Permission[],
        impersonatedBy: user as User,
      }
    }
  }

  return {
    user: user as User,
    organization: organization as Organization,
    permissions: (permissions || []) as Permission[],
  }
})

export const getOptionalSession = cache(async function getOptionalSession() {
  const anonClient = await createServerSupabaseClient()
  const { data: { user: authUser } } = await anonClient.auth.getUser()

  if (!authUser) return null

  const supabase = await createServiceRoleClient()
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return user as User | null
})
