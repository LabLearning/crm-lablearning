/**
 * Qui voit quelles tâches de l'équipe (module Tâches, agenda, journal).
 *
 * Les tâches d'admin à admin ne regardent que les admins (demande du
 * 19/10/2026) : une tâche créée par un admin et confiée à un admin, ou à
 * personne, n'apparaît pas aux autres membres de l'équipe (gestionnaire,
 * commercial). Ceux-ci voient tout le reste : leurs tâches, celles qu'ils ont
 * créées (y compris confiées à un admin), celles de leurs collègues et celles
 * qu'un admin leur confie.
 *
 * La règle vaut pour la lecture comme pour les actions : une tâche invisible
 * n'existe pas pour le compte qui ne la voit pas (ni modification, ni
 * commentaire, ni mémo).
 */

export const ROLES_ADMIN_TACHES: string[] = ['super_admin']

export const estAdminTaches = (role?: string | null) => !!role && ROLES_ADMIN_TACHES.includes(role)

export interface TacheVisibilite {
  created_by: string | null
  assignee_id: string | null
}

/** La tâche est-elle visible pour ce lecteur ? `roleDe` donne le rôle d'un compte (créateur, destinataire). */
export function tacheVisible(
  t: TacheVisibilite,
  lecteur: { id: string; role: string },
  roleDe: (id: string | null) => string | null | undefined,
): boolean {
  if (estAdminTaches(lecteur.role)) return true
  if ((t.created_by && t.created_by === lecteur.id) || (t.assignee_id && t.assignee_id === lecteur.id)) return true
  const entreAdmins = estAdminTaches(roleDe(t.created_by)) && (!t.assignee_id || estAdminTaches(roleDe(t.assignee_id)))
  return !entreAdmins
}

/** Rôles des comptes de l'organisme, pour appliquer la règle côté serveur. */
export async function rolesDesComptes(supabase: any, orgId: string, ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const uniques = [...new Set(ids.filter((x): x is string => !!x))]
  const roles = new Map<string, string>()
  if (!uniques.length) return roles
  const { data } = await supabase.from('users').select('id, role').eq('organization_id', orgId).in('id', uniques)
  for (const u of (data || []) as Array<{ id: string; role: string }>) roles.set(u.id, u.role)
  return roles
}

/** Ne garde que les tâches visibles pour ce lecteur. */
export async function filtrerTachesVisibles<T extends TacheVisibilite>(
  supabase: any, orgId: string, lecteur: { id: string; role: string }, taches: T[],
): Promise<T[]> {
  if (estAdminTaches(lecteur.role) || !taches.length) return taches
  const roles = await rolesDesComptes(supabase, orgId, taches.flatMap((t) => [t.created_by, t.assignee_id]))
  return taches.filter((t) => tacheVisible(t, lecteur, (id) => (id ? roles.get(id) : null)))
}

/**
 * Lit une tâche de l'organisme et dit si le compte connecté peut la voir.
 * Renvoie null si elle n'existe pas ou si elle lui est cachée : les actions
 * répondent alors « Tâche introuvable », sans révéler qu'elle existe.
 */
export async function tacheAccessible(
  supabase: any, orgId: string, lecteur: { id: string; role: string }, id: string,
): Promise<{ id: string; titre: string; assignee_id: string | null; created_by: string | null; status: string; position: number } | null> {
  const { data: tache } = await supabase.from('crm_taches')
    .select('id, titre, assignee_id, created_by, status, position')
    .eq('id', id).eq('organization_id', orgId).maybeSingle()
  if (!tache) return null
  const [visible] = await filtrerTachesVisibles(supabase, orgId, lecteur, [tache])
  return visible || null
}
