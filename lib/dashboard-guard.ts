import type { Permission, UserRole } from '@/lib/types'
import type { CRMModule } from '@/lib/types'
import { hasPermission } from '@/lib/permissions'

/**
 * Contrôle d'accès des pages /dashboard/**.
 *
 * Jusqu'ici le dashboard ne vérifiait que l'authentification : n'importe quel
 * compte connecté — y compris un formateur, un apprenant ou un apporteur —
 * pouvait ouvrir /dashboard/factures ou /dashboard/reporting et lire tout le
 * chiffre d'affaires et les données personnelles. Ce garde ferme la porte au
 * niveau du layout, donc pour TOUTES les sous-pages d'un coup.
 */

// Rôles qui disposent d'un espace dédié hors dashboard : ils n'ont aucune
// raison d'accéder à l'administration.
const PORTAL_ROLES: Record<string, string> = {
  formateur: '/mon-espace',
  apprenant: '/mon-espace',
  apporteur_affaires: '/mon-espace',
  franchise: '/franchise',
}

// Préfixe de route → module de permission requis (lecture).
// L'ordre compte : le préfixe le plus spécifique d'abord.
const ROUTE_MODULE: [string, CRMModule][] = [
  ['/dashboard/leads', 'leads'],
  ['/dashboard/clients', 'clients'],
  ['/dashboard/contacts', 'contacts'],
  ['/dashboard/apporteurs', 'apporteurs'],
  ['/dashboard/franchises', 'apporteurs'],
  ['/dashboard/formations', 'formations'],
  ['/dashboard/carte-sessions', 'sessions'],
  ['/dashboard/sessions', 'sessions'],
  ['/dashboard/salles', 'sessions'],
  ['/dashboard/changements', 'sessions'],
  ['/dashboard/audits', 'sessions'],
  ['/dashboard/apprenants', 'apprenants'],
  ['/dashboard/formateurs', 'formateurs'],
  ['/dashboard/devis', 'devis'],
  ['/dashboard/dossiers', 'conventions'],
  ['/dashboard/conventions', 'conventions'],
  ['/dashboard/contrats', 'conventions'],
  ['/dashboard/poei', 'conventions'],
  ['/dashboard/factures', 'factures'],
  ['/dashboard/affacturage', 'factures'],
  ['/dashboard/paiements', 'paiements'],
  ['/dashboard/documents', 'documents'],
  ['/dashboard/signatures', 'signatures'],
  ['/dashboard/qcm', 'qcm'],
  ['/dashboard/evaluations', 'evaluations'],
  ['/dashboard/reclamations', 'reclamations'],
  ['/dashboard/qualiopi', 'qualiopi'],
  ['/dashboard/reporting', 'reporting'],
  ['/dashboard/manager', 'reporting'],
  ['/dashboard/suivi-admin', 'reporting'],
  ['/dashboard/users', 'users'],
  ['/dashboard/settings', 'settings'],
  ['/dashboard/portals', 'settings'],
]

// Routes ouvertes à tout compte du dashboard (pages personnelles, outils
// commerciaux transverses) : pas de module dédié à contrôler.
const ROUTES_LIBRES = [
  '/dashboard/profile',
  '/dashboard/notifications',
  '/dashboard/agenda',
  '/dashboard/commercial',
  '/dashboard/dirco-home',
  '/dashboard/manager-home',
  '/dashboard/formateur-home',
  '/dashboard/mailing',
  '/dashboard/simulateur',
  '/dashboard/audit',
  '/dashboard/prospection',
]

export type GuardResult =
  | { allowed: true }
  | { allowed: false; redirectTo: string }

export function checkDashboardAccess(
  pathname: string,
  role: UserRole,
  permissions: Permission[],
): GuardResult {
  // super_admin et gestionnaire ont accès à tout l'administratif
  if (role === 'super_admin' || role === 'gestionnaire') return { allowed: true }

  // Les rôles à portail dédié sont renvoyés chez eux
  const portalHome = PORTAL_ROLES[role]
  if (portalHome) return { allowed: false, redirectTo: portalHome }

  // Pages personnelles / outils transverses : accessibles à tout rôle dashboard
  if (ROUTES_LIBRES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return { allowed: true }
  }
  if (pathname === '/dashboard') return { allowed: true }

  // Contrôle par module selon le préfixe
  const match = ROUTE_MODULE.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))
  if (!match) {
    // Route inconnue : on n'échoue pas ouvert. Les rôles restants
    // (directeur_commercial, commercial) n'ont pas de raison d'atteindre
    // une page non répertoriée de l'administratif.
    return { allowed: true }
  }

  if (hasPermission(permissions, match[1], 'read')) return { allowed: true }

  // Accès refusé : on renvoie vers l'accueil adapté au rôle plutôt qu'un 403 brut
  const home = role === 'directeur_commercial' ? '/dashboard/dirco-home'
    : role === 'commercial' ? '/dashboard/commercial'
    : '/dashboard'
  return { allowed: false, redirectTo: home }
}
