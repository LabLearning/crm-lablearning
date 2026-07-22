import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, permissions, impersonatedBy } = await getSession()

  // Contrôle de rôle sur toute page /dashboard/** : sans lui, un compte
  // formateur ou apprenant pouvait lire les finances et les données clients.
  const pathname = headers().get('x-pathname') || ''
  if (pathname.startsWith('/dashboard')) {
    const access = checkDashboardAccess(pathname, user.role as any, permissions)
    if (!access.allowed) redirect(access.redirectTo)
  }

  return (
    <DashboardShell
      user={user}
      orgName={organization.name}
      permissions={permissions}
      impersonatedBy={impersonatedBy}
    >
      {children}
    </DashboardShell>
  )
}
