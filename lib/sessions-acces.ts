import type { SessionContext } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { hasPermission, isAdmin } from '@/lib/permissions'

/**
 * Droit de gérer les sessions, pour les actions serveur du module.
 *
 * Ces actions sont aussi joignables hors du tableau de bord (/mon-espace
 * importe le module pour les missions du formateur) : là, le contrôle central
 * de rôle ne joue pas. Chacune vérifie donc que le compte fait partie du
 * personnel (checkDashboardAccess écarte formateur, apprenant, apporteur et
 * franchise) et qu'il a le droit voulu sur les sessions. Le refus des comptes
 * externes compte : le formateur a « sessions : modifier » en base.
 */
export function peutGererSessions(session: SessionContext, droit: 'create' | 'update' | 'delete'): boolean {
  if (!checkDashboardAccess('/dashboard/sessions', session.user.role as any, session.permissions).allowed) return false
  // Le directeur commercial gère les sessions dans le reste du module (fiche
  // session, pièces, factures OPCO) : il crée et modifie, il ne supprime pas
  if (session.user.role === 'directeur_commercial' && droit !== 'delete') return true
  return isAdmin(session.user.role) || hasPermission(session.permissions, 'sessions', droit)
}

/** Rôles qui fixent la rémunération du formateur d'une session (même règle que sur la fiche). */
export const ROLES_REMUNERATION_FORMATEUR = ['super_admin', 'gestionnaire', 'directeur_commercial']
