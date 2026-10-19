/**
 * Espaces du tableau de bord réservés par rôle, en plus des permissions par
 * module (demande du 19/10/2026, recrutement d'une assistante de direction au
 * profil gestionnaire) :
 * - la partie Système (utilisateurs, journal d'activité, paramètres, portails)
 *   est à l'admin seul : le gestionnaire n'ajoute, ne modifie et ne retire
 *   aucun compte de l'équipe ;
 * - la rentabilité, l'affacturage et la trésorerie sont à l'admin et au
 *   comptable, ni au gestionnaire ni aux commerciaux.
 *
 * Module sans dépendance : il sert au garde d'accès, au menu (navigateur), aux
 * pages et aux actions serveur. Une règle se pose ici, puis se vérifie à chacun
 * de ces niveaux : le garde du layout ne se rejoue pas quand on passe d'une
 * page à l'autre du tableau de bord.
 */

export const ROLES_SYSTEME: string[] = ['super_admin']
export const ROLES_FINANCES_RESERVEES: string[] = ['super_admin', 'comptable']
/** Le chiffre d'affaires de l'organisme (tableaux de bord, rapports, totaux) : l'admin seul. */
export const ROLES_CHIFFRE_AFFAIRES: string[] = ['super_admin']

export const ROUTES_RESERVEES: Array<[string, string[]]> = [
  ['/dashboard/users', ROLES_SYSTEME],
  ['/dashboard/activite', ROLES_SYSTEME],
  ['/dashboard/settings', ROLES_SYSTEME],
  ['/dashboard/portals', ROLES_SYSTEME],
  ['/dashboard/rentabilite', ROLES_FINANCES_RESERVEES],
  ['/dashboard/affacturage', ROLES_FINANCES_RESERVEES],
  ['/dashboard/tresorerie', ROLES_FINANCES_RESERVEES],
  ['/dashboard/reporting', ROLES_CHIFFRE_AFFAIRES],
  ['/dashboard/manager', ROLES_CHIFFRE_AFFAIRES],
  // L'accueil du directeur commercial reste le sien (sinon il tournerait en rond)
  ['/dashboard/dirco-home', ['super_admin', 'directeur_commercial']],
]

/** Rôles autorisés sur ce chemin s'il est réservé, sinon null. */
export function rolesDeLaRoute(pathname: string): string[] | null {
  const chemin = pathname.split('?')[0]
  const route = ROUTES_RESERVEES.find(([prefixe]) => chemin === prefixe || chemin.startsWith(prefixe + '/'))
  return route ? route[1] : null
}

export const peutAdministrer = (role: string | null | undefined) => !!role && ROLES_SYSTEME.includes(role)
export const peutVoirFinancesReservees = (role: string | null | undefined) => !!role && ROLES_FINANCES_RESERVEES.includes(role)
export const peutVoirChiffreAffaires = (role: string | null | undefined) => !!role && ROLES_CHIFFRE_AFFAIRES.includes(role)
