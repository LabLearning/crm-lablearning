import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { definirActeur } from '@/lib/acteur'
import { cache } from 'react'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import type { User, Organization, Permission } from '@/lib/types'

export interface SessionContext {
  user: User
  organization: Organization
  permissions: Permission[]
  impersonatedBy?: User
}

/**
 * Une action serveur s'exécute avant le layout du tableau de bord, donc sans
 * son contrôle de rôle : un formateur connecté pouvait lancer une action
 * d'administration en l'appelant directement. Le contrôle se rejoue ici pour
 * toute requête sous /dashboard, page comme action.
 */
function exigerAccesDashboard(role: string, permissions: Permission[]) {
  const pathname = headers().get('x-pathname') || ''
  if (!pathname.startsWith('/dashboard')) return
  const acces = checkDashboardAccess(pathname, role as any, permissions)
  if (!acces.allowed) redirect(acces.redirectTo)
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

  // Dès maintenant, toute écriture de cette requête lui est attribuée
  definirActeur(authUser.id)

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

  // Un compte suspendu est déconnecté, où qu'il aille
  if (user.status === 'suspended') redirect('/auth/suspendu')

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
      // Le compte emprunté est l'acteur ; le super administrateur est mentionné en « par »
      definirActeur(impersonatedUser.id, user.id)
      const { data: impersonatedPermissions } = await supabase
        .from('permissions')
        .select('*')
        .eq('organization_id', impersonatedUser.organization_id)
        .eq('role', impersonatedUser.role)

      exigerAccesDashboard(impersonatedUser.role, (impersonatedPermissions || []) as Permission[])
      return {
        user: impersonatedUser as User,
        organization: organization as Organization,
        permissions: (impersonatedPermissions || []) as Permission[],
        impersonatedBy: user as User,
      }
    }
  }

  exigerAccesDashboard(user.role, (permissions || []) as Permission[])
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

  // Les routes API qui passent par ici signent aussi leurs écritures
  definirActeur(authUser.id)

  const supabase = await createServiceRoleClient()
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (user?.status === 'suspended') return null
  return user as User | null
})
