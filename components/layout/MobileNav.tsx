'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from '@/components/ui/icons'
import {
  LayoutDashboard, UserPlus, Building2, Users, Handshake, FileText,
  GraduationCap, Calendar, UserCheck, UserX, Presentation, FileSignature, FilePen,
  FolderOpen, PenTool, Receipt, CreditCard, ClipboardCheck, ListChecks,
  ShieldCheck, MessageSquareWarning, BarChart3, Shield, Settings, Globe,
  Calculator, ClipboardList, Send, CalendarDays, Mails, PieChart, Layers, MapPin, Clock,
  CheckSquare, Briefcase, UserCog, Banknote, Store, AlertTriangle, Compass, ReceiptText, ReceiptEuro, LifeBuoy, FolderCheck,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { hasAnyPermission } from '@/lib/permissions'
import type { Permission, CRMModule } from '@/lib/types'
import { navigation } from '@/lib/navigation'

// Même table que la Sidebar : une entrée sans icône serait décalée dans la liste
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, UserPlus, Building2, Users, Handshake, FileText,
  GraduationCap, Calendar, UserCheck, UserX, Presentation, FileSignature, FilePen,
  FolderOpen, PenTool, Receipt, CreditCard, ClipboardCheck, ListChecks,
  ShieldCheck, MessageSquareWarning, BarChart3, Shield, Settings, Globe,
  Calculator, ClipboardList, Send, CalendarDays, Mails, PieChart, Layers, MapPin, Clock,
  CheckSquare, Briefcase, UserCog, Banknote, Store, AlertTriangle, Compass, ReceiptText, ReceiptEuro, LifeBuoy,
  FolderCheck,
}

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  permissions: Permission[]
  orgName: string
  userRole: string
}

/**
 * Menu latéral sur téléphone : panneau 300 px (85 % de l'écran au plus),
 * entrées de 44 px, défilement interne, fermeture au toucher du voile,
 * à la touche Échap et après navigation. Le corps de page est verrouillé
 * pendant l'ouverture pour que le fond ne défile pas sous le doigt.
 */
export function MobileNav({ isOpen, onClose, permissions, orgName, userRole }: MobileNavProps) {
  const pathname = usePathname()

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href.split('?')[0])
  }

  const isVisible = (item: { module?: CRMModule; hideForRoles?: string[] }) => {
    if (item.hideForRoles?.includes(userRole)) return false
    return !item.module || hasAnyPermission(permissions, item.module)
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
      <div className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="absolute left-0 top-0 bottom-0 w-[300px] max-w-[85vw] bg-white shadow-modal animate-slide-left flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between h-[60px] px-4 border-b border-surface-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-8 shrink-0" style={{ maxWidth: 140 }} />
          </div>
          <button onClick={onClose} aria-label="Fermer le menu"
            className="h-10 w-10 -mr-2 flex items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 active:bg-surface-200/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-surface-100 shrink-0">
          <div className="text-xs font-semibold text-surface-700 truncate">{orgName}</div>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-2 px-2.5 safe-bottom">
          {navigation.map((section) => {
            const visibleItems = section.items.filter((item) => isVisible(item))
            if (visibleItems.length === 0) return null

            return (
              <div key={section.title} className="mb-1.5">
                <div className="px-2.5 pt-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-brand-500">{section.title}</div>
                <div className="space-y-px">
                  {visibleItems.map((item) => {
                    const Icon = iconMap[item.icon]
                    const active = isActive(item.href)
                    const sky = item.accent === 'sky'
                    return (
                      <Link key={item.href} href={item.href} onClick={onClose}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 min-h-[44px] transition-colors duration-150 active:bg-surface-100',
                          active
                            ? (sky ? 'bg-sky-50 text-sky-700' : 'bg-brand-50 text-brand-700')
                            : cn('text-surface-600', sky && 'text-sky-600'),
                        )}>
                        {Icon && <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? (sky ? 'text-sky-600' : 'text-brand-600') : sky ? 'text-sky-500' : 'text-surface-400')} />}
                        <span className="text-sm font-semibold truncate">{item.label}</span>
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
