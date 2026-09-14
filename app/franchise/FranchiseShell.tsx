'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, Building2, GraduationCap, ClipboardCheck, Banknote, AlertTriangle, TrendingUp, LogOut, ChevronDown, UserCog, X } from '@/components/ui/icons'
import { Avatar } from '@/components/ui'
import { ToastProvider } from '@/components/ui/Toast'
import { NotificationsBell } from '@/components/layout/NotificationsBell'
import { stopImpersonationAction } from '@/app/dashboard/users/actions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'

interface NavItem { label: string; short: string; href: string; icon: React.ElementType }

const nav: NavItem[] = [
  { label: 'Tableau de bord', short: 'Accueil', href: '', icon: LayoutDashboard },
  { label: 'Formations', short: 'Format.', href: '/formations', icon: GraduationCap },
  { label: 'Commissions', short: 'Commis.', href: '/financier', icon: Banknote },
  { label: 'Établissements', short: 'Établis.', href: '/etablissements', icon: Building2 },
  { label: 'Audits', short: 'Audits', href: '/audits', icon: ClipboardCheck },
  { label: 'Incidents', short: 'Incidents', href: '/incidents', icon: AlertTriangle },
  { label: 'Prévision', short: 'Prévision', href: '/prevision', icon: TrendingUp },
]

const PORTAL_GREEN = '#205040'

export function FranchiseShell({
  user, franchiseName, franchiseLogo, orgName, children, isImpersonating,
}: { user: User; franchiseName: string; franchiseLogo?: string | null; orgName: string; children: React.ReactNode; isImpersonating?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const basePath = '/franchise'

  const firstName = user.first_name || 'F'
  const lastName = user.last_name || ''
  const fullName = `${user.first_name} ${user.last_name}`.trim() || franchiseName

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function isActive(href: string) {
    const full = basePath + href
    if (href === '') return pathname === basePath || pathname === basePath + '/'
    return pathname.startsWith(full)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleStopImpersonation() {
    await stopImpersonationAction()
    router.push('/dashboard/franchises')
    router.refresh()
  }

  const UserMenu = (
    <div ref={menuRef} className="relative">
      <button onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-surface-50 transition-colors">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-surface-800 leading-none">{fullName}</div>
          <div className="text-[11px] text-surface-400 mt-0.5">{franchiseName}</div>
        </div>
        <Avatar firstName={firstName} lastName={lastName} size="sm" />
        <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-surface-200 shadow-elevated py-1 animate-in-scale origin-top-right z-50">
          <div className="px-3.5 py-2.5 border-b border-surface-100">
            <div className="text-sm font-medium text-surface-900 truncate">{fullName}</div>
            <div className="text-xs text-surface-400 truncate">{user.email}</div>
            <div className="text-[11px] text-surface-400 mt-1 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PORTAL_GREEN }} /> {franchiseName}
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-danger-600 hover:bg-danger-50">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      )}
    </div>
  )

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-50">
        {/* Bannière impersonation */}
        {isImpersonating && (
          <div className="sticky top-0 z-40 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <UserCog className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium truncate">
                Mode aperçu — Vous voyez l'espace de <strong>{franchiseName}</strong> ({fullName})
              </span>
            </div>
            <button onClick={handleStopImpersonation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors shrink-0">
              <X className="h-3.5 w-3.5" /> Retour à mon compte
            </button>
          </div>
        )}
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-surface-200/60">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-6 shrink-0" />
              {franchiseLogo && (
                <>
                  <span className="text-surface-300 text-sm shrink-0">×</span>
                  <img src={franchiseLogo} alt={franchiseName} className="h-6 max-w-[90px] object-contain shrink-0" />
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <NotificationsBell userId={user.id} allHref="/franchise/notifications" />
              {UserMenu}
            </div>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden md:block sticky top-0 z-30 bg-white border-b border-surface-200/60">
          <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-9 shrink-0" />
              {franchiseLogo && (
                <>
                  <span className="text-surface-300 text-lg font-light shrink-0">×</span>
                  <img src={franchiseLogo} alt={franchiseName} className="h-9 max-w-[140px] object-contain shrink-0" />
                </>
              )}
              <div className="border-l border-surface-200 pl-3">
                <div className="text-sm font-heading font-semibold text-surface-900 leading-none">{franchiseName}</div>
                <div className="text-[10px] text-surface-400 mt-1">Espace franchise · {orgName}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsBell userId={user.id} allHref="/franchise/notifications" />
              {UserMenu}
            </div>
          </div>

          {/* Desktop tab nav */}
          <div className="border-t border-surface-100">
            <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
              <nav className="flex gap-1 -mb-px overflow-x-auto">
                {nav.map((item) => (
                  <Link key={item.href} href={basePath + item.href}
                    className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      isActive(item.href) ? 'text-[#205040]' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300')}
                    style={isActive(item.href) ? { borderBottomColor: PORTAL_GREEN } : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 py-5 md:py-8 pb-28 md:pb-10">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/97 backdrop-blur-md border-t border-surface-200/80"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="grid grid-cols-6">
            {nav.map((item) => {
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={basePath + item.href}
                  className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-all duration-200 active:scale-95">
                  {active && <span className="absolute top-0 left-3 right-3 h-[2px] rounded-full" style={{ backgroundColor: PORTAL_GREEN }} />}
                  <item.icon className="h-[22px] w-[22px]" style={{ color: active ? PORTAL_GREEN : '#a8a29e' }} />
                  <span className="text-[10px] font-medium leading-none" style={{ color: active ? PORTAL_GREEN : '#a8a29e' }}>{item.short}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </ToastProvider>
  )
}
