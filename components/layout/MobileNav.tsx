'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import {
  LayoutDashboard, UserPlus, Building2, Users, Handshake, FileText,
  GraduationCap, Calendar, UserCheck, Presentation, FileSignature,
  FolderOpen, PenTool, Receipt, CreditCard, ClipboardCheck, ListChecks,
  ShieldCheck, MessageSquareWarning, BarChart3, Shield, Settings, Globe,
  Calculator, ClipboardList, Send, CalendarDays, Mails, PieChart, Layers, MapPin, Clock,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasAnyPermission } from '@/lib/permissions'
import type { Permission, CRMModule } from '@/lib/types'
import { navigation } from '@/lib/navigation'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, UserPlus, Building2, Users, Handshake, FileText,
  GraduationCap, Calendar, UserCheck, Presentation, FileSignature,
  FolderOpen, PenTool, Receipt, CreditCard, ClipboardCheck, ListChecks,
  ShieldCheck, MessageSquareWarning, BarChart3, Shield, Settings, Globe,
  Calculator, ClipboardList, Send, CalendarDays, Mails, PieChart, Layers, MapPin, Clock,
  Briefcase,
}

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  permissions: Permission[]
  orgName: string
  userRole: string
}

export function MobileNav({ isOpen, onClose, permissions, orgName, userRole }: MobileNavProps) {
  const pathname = usePathname()

  if (!isOpen) return null

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const isVisible = (item: { module?: CRMModule; hideForRoles?: string[] }) => {
    if (item.hideForRoles?.includes(userRole)) return false
    return !item.module || hasAnyPermission(permissions, item.module)
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-white shadow-modal animate-slide-left">
        {/* Header */}
        <div className="flex items-center justify-between h-[60px] px-4 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-surface-900 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-8" />
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-surface-400 hover:bg-surface-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="overflow-y-auto py-3 px-2.5 max-h-[calc(100vh-60px)]">
          {navigation.map((section) => {
            const visibleItems = section.items.filter((item) => isVisible(item))
            if (visibleItems.length === 0) return null

            return (
              <div key={section.title} className="mb-2">
                <div className="px-2.5 py-1.5 section-label">{section.title}</div>
                <div className="space-y-px mt-0.5">
                  {visibleItems.map((item) => {
                    const Icon = iconMap[item.icon]
                    const active = isActive(item.href)
                    return (
                      <Link key={item.href} href={item.href} onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl px-2.5 py-[7px] transition-all duration-150',
                          active ? 'bg-surface-900 text-white' : 'text-surface-500 hover:bg-surface-100 hover:text-surface-800'
                        )}>
                        {Icon && <Icon className={cn('h-4 w-4', active ? 'text-white' : '')} />}
                        <span className="text-[13px] font-medium">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
