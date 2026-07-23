'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, GraduationCap, FileText, ClipboardCheck,
  Calendar, ListChecks, Star, Users, CheckSquare,
  Receipt, FileSignature, Building2, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import type { PortalContext } from '@/lib/portal-auth'

interface NavItem {
  label: string
  short: string
  href: string
  icon: React.ElementType
}

interface PortalShellProps { context: PortalContext; children: React.ReactNode }

const apprenantNav: NavItem[] = [
  { label: 'Accueil', short: 'Accueil', href: '', icon: LayoutDashboard },
  { label: 'Mes formations', short: 'Formations', href: '/formations', icon: GraduationCap },
  { label: 'Documents', short: 'Docs', href: '/documents', icon: FileText },
  { label: 'Evaluations', short: 'Évals', href: '/evaluations', icon: ClipboardCheck },
  { label: 'Questionnaires', short: 'QCM', href: '/questionnaires', icon: ListChecks },
]

const formateurNav: NavItem[] = [
  { label: 'Accueil', short: 'Accueil', href: '', icon: LayoutDashboard },
  { label: 'Mes sessions', short: 'Sessions', href: '/sessions', icon: Calendar },
  { label: 'Apprenants', short: 'Apprenants', href: '/apprenants', icon: Users },
  { label: 'Emargement', short: 'Émarg.', href: '/emargement', icon: CheckSquare },
  { label: 'Contenu pédagogique', short: 'Contenu', href: '/contenu', icon: BookOpen },
  { label: 'Questionnaires', short: 'QCM', href: '/qcm', icon: ListChecks },
  { label: 'Evaluations', short: 'Évals', href: '/evaluations', icon: Star },
  { label: 'Documents', short: 'Docs', href: '/documents', icon: FileText },
]

const clientNav: NavItem[] = [
  { label: 'Accueil', short: 'Accueil', href: '', icon: LayoutDashboard },
  { label: 'Formations', short: 'Formations', href: '/formations-client', icon: GraduationCap },
  { label: 'Conventions', short: 'Conventions', href: '/conventions-client', icon: FileSignature },
  { label: 'Factures', short: 'Factures', href: '/factures-client', icon: Receipt },
  { label: 'Documents', short: 'Docs', href: '/documents', icon: FileText },
]

const apporteurNav: NavItem[] = [
  { label: 'Accueil', short: 'Accueil', href: '', icon: LayoutDashboard },
  { label: 'Mes leads', short: 'Leads', href: '/leads-apporteur', icon: Users },
  { label: 'Commissions', short: 'Commissions', href: '/commissions-apporteur', icon: Receipt },
]

const partenaireNav: NavItem[] = [
  { label: 'Tableau de bord', short: 'Tableau', href: '', icon: LayoutDashboard },
  { label: 'Dossiers', short: 'Dossiers', href: '/dossiers-partenaire', icon: FileSignature },
  { label: 'Sessions', short: 'Sessions', href: '/sessions-partenaire', icon: Calendar },
  { label: 'Leads', short: 'Leads', href: '/leads-apporteur', icon: Users },
  { label: 'Commissions', short: 'Commis.', href: '/commissions-apporteur', icon: Receipt },
]

function isPartenaire(ctx: PortalContext) {
  return ctx.type === 'apporteur' && ctx.apporteur.categorie === 'partenaire'
}

function getDisplayInfo(ctx: PortalContext) {
  if (ctx.type === 'apprenant') return {
    name: ctx.apprenant.prenom + ' ' + ctx.apprenant.nom,
    firstName: ctx.apprenant.prenom,
    lastName: ctx.apprenant.nom,
    subtitle: 'Espace apprenant',
  }
  if (ctx.type === 'formateur') return {
    name: ctx.formateur.prenom + ' ' + ctx.formateur.nom,
    firstName: ctx.formateur.prenom,
    lastName: ctx.formateur.nom,
    subtitle: 'Espace formateur',
  }
  if (ctx.type === 'client') {
    const c = ctx.contact
    return {
      name: c ? c.prenom + ' ' + c.nom : (ctx.client.raison_sociale || 'Client'),
      firstName: c?.prenom || ctx.client.raison_sociale?.charAt(0) || 'C',
      lastName: c?.nom || '',
      subtitle: 'Espace client',
    }
  }
  if (ctx.type === 'apporteur') {
    const isP = ctx.apporteur.categorie === 'partenaire'
    const label = isP
      ? ('Partenaire' + (ctx.apporteur.nom_enseigne ? ' · ' + ctx.apporteur.nom_enseigne : ''))
      : 'Apporteur d\'affaires'
    return {
      name: (ctx.apporteur.prenom || '') + ' ' + ctx.apporteur.nom,
      firstName: ctx.apporteur.prenom || ctx.apporteur.nom.charAt(0),
      lastName: ctx.apporteur.nom,
      subtitle: label,
    }
  }
  return { name: '', firstName: '', lastName: '', subtitle: '' }
}

// Portal brand color
const PORTAL_GREEN = '#195144'

export function PortalShell({ context, children }: PortalShellProps) {
  const pathname = usePathname()
  const basePath = '/portail/' + context.token
  const nav = context.type === 'apprenant'
    ? apprenantNav
    : context.type === 'formateur'
    ? formateurNav
    : context.type === 'apporteur'
    ? (isPartenaire(context) ? partenaireNav : apporteurNav)
    : clientNav
  const info = getDisplayInfo(context)

  // For mobile bottom nav, limit to 5 items max for formateur (6 items)
  // Toutes les entrées restent accessibles sur mobile (barre défilante au-delà de 5)
  const mobileNav = nav

  function isActive(href: string) {
    const full = basePath + href
    if (href === '') return pathname === basePath || pathname === basePath + '/'
    return pathname.startsWith(full)
  }

  return (
    <div className="min-h-screen bg-surface-50">

      {/* ── Mobile header (< md) ─────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-surface-200/60">
        <div className="h-14 px-4 flex items-center justify-between">
          {/* Logo + org name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-7 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-surface-400 leading-none">{info.subtitle}</div>
            </div>
          </div>
          {/* User avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden xs:block">
              <div className="text-xs font-medium text-surface-700 leading-tight">{info.name}</div>
            </div>
            <Avatar firstName={info.firstName} lastName={info.lastName} size="sm" />
          </div>
        </div>
      </header>

      {/* ── Desktop header (≥ md) ────────────────────────────── */}
      <header className="hidden md:block sticky top-0 z-30 bg-white border-b border-surface-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-lablearning.svg" alt="Lab Learning" className="h-9 shrink-0" />
            <div>
              <div className="text-[10px] text-surface-400">{info.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-surface-800">{info.name}</div>
              <div className="text-[10px] text-surface-500 capitalize">{context.type}</div>
            </div>
            <Avatar firstName={info.firstName} lastName={info.lastName} size="sm" />
          </div>
        </div>
        {/* Desktop tab nav */}
        <div className="border-t border-surface-100">
          <div className="max-w-6xl mx-auto px-6">
            <nav className="flex gap-1 -mb-px">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={basePath + item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive(item.href)
                      ? 'border-b-2 text-[#195144]'
                      : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                  )}
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

      {/* ── Main content ─────────────────────────────────────── */}
      {/* pb-24 on mobile clears the fixed bottom nav */}
      <main className="max-w-6xl mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-8 pb-28 md:pb-10">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/97 backdrop-blur-md border-t border-surface-200/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className={cn(
          // Toutes les entrées visibles d'un coup : au-delà de 5, la grille
          // passe sur deux lignes (grid-cols-4) plutôt qu'un défilement caché.
          'grid',
          mobileNav.length === 3 && 'grid-cols-3',
          mobileNav.length === 4 && 'grid-cols-4',
          mobileNav.length === 5 && 'grid-cols-5',
          mobileNav.length > 5 && 'grid-cols-4',
        )}>
          {mobileNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={basePath + item.href}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-all duration-200 active:scale-95"
              >
                {/* Active indicator — top bar */}
                {active && (
                  <span
                    className="absolute top-0 left-3 right-3 h-[2px] rounded-full"
                    style={{ backgroundColor: PORTAL_GREEN }}
                  />
                )}
                {/* Icon */}
                <item.icon
                  className="h-[22px] w-[22px] transition-colors"
                  style={{ color: active ? PORTAL_GREEN : '#a8a29e' }}
                />
                {/* Label */}
                <span
                  className="text-[10px] font-medium leading-none transition-colors"
                  style={{ color: active ? PORTAL_GREEN : '#a8a29e' }}
                >
                  {item.short}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
