'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { ToastProvider } from '@/components/ui/Toast'
import { ImpersonationBanner } from './ImpersonationBanner'
import { AssistantWidget } from '@/components/assistant/AssistantWidget'
import { cn } from '@/lib/utils'
import type { User, Permission } from '@/lib/types'

interface DashboardShellProps {
  user: User
  orgName: string
  permissions: Permission[]
  children: React.ReactNode
  impersonatedBy?: User
}


export function DashboardShell({ user, orgName, permissions, children, impersonatedBy }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-50">
        {impersonatedBy && <ImpersonationBanner user={user} />}

        {/* Sidebar (desktop) */}
        <div className={cn('hidden lg:block', impersonatedBy && 'pt-10')}>
          <Sidebar
            permissions={permissions}
            orgName={orgName}
            userRole={user.role}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile nav */}
        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          permissions={permissions}
          orgName={orgName}
          userRole={user.role}
        />

        {/* Main content */}
        <div className={cn(
          'transition-all duration-300 ease-out',
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[256px]',
          impersonatedBy && 'pt-10'
        )}>
          <Header user={user} onMobileMenuToggle={() => setMobileNavOpen(true)} />
          <main className="p-4 pb-24 sm:p-5 lg:p-7 lg:pb-7 xl:p-8 xl:pb-8 max-w-[1440px] min-w-0 overflow-x-clip lg:overflow-visible">
            {children}
          </main>
        </div>

        {/* Assistant CRM interne : jamais pour les comptes formateur/apprenant */}
        {!['formateur', 'apprenant'].includes(user.role) && <AssistantWidget />}
      </div>
    </ToastProvider>
  )
}
