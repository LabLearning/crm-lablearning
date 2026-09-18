import { cache } from 'react'

/**
 * Qui agit pendant cette requête.
 *
 * getSession() le renseigne dès qu'un utilisateur est identifié ;
 * createServiceRoleClient() le transmet à la base dans un en-tête HTTP, que
 * le déclencheur du journal d'activité recopie sur chaque écriture. Mémoïsé
 * par requête (React cache) : hors requête, l'objet est neuf et vide, ce qui
 * attribue l'écriture au système.
 */
export const acteurCourant = cache(() => ({ id: null as string | null, impersonePar: null as string | null }))

export function definirActeur(id: string | null, impersonePar: string | null = null) {
  try {
    const a = acteurCourant()
    a.id = id
    a.impersonePar = impersonePar
  } catch {
    // Hors contexte React (script, tâche planifiée) : rien à attribuer
  }
}

/** En-têtes à joindre aux requêtes Supabase pour attribuer les écritures. */
export function entetesActeur(): Record<string, string> {
  try {
    const a = acteurCourant()
    if (!a.id) return {}
    return {
      'x-acteur-id': a.id,
      ...(a.impersonePar ? { 'x-acteur-impersone-par': a.impersonePar } : {}),
    }
  } catch {
    return {}
  }
}
