import { requestAsyncStorage } from 'next/dist/client/components/request-async-storage.external'

/**
 * Qui agit pendant cette requête.
 *
 * getSession() le renseigne dès qu'un utilisateur est identifié ;
 * createServiceRoleClient() le transmet à la base dans un en-tête HTTP, que
 * le déclencheur du journal d'activité recopie sur chaque écriture.
 *
 * Mémoïsé par requête HTTP en s'appuyant sur le RequestStore de Next : le
 * même objet pendant le rendu d'un Server Component, l'exécution d'une Server
 * Action et un route handler app/api (React.cache, lui, ne mémoïse que
 * pendant un rendu Flight : une Server Action s'exécute avant tout rendu et
 * perdait l'acteur). Hors requête (script, tâche planifiée), l'objet est neuf
 * et vide, ce qui attribue l'écriture au système.
 */
interface Acteur { id: string | null; impersonePar: string | null }

const registre = new WeakMap<object, Acteur>()

function cleRequete(): object | null {
  try {
    return requestAsyncStorage.getStore() ?? null
  } catch {
    return null
  }
}

export function acteurCourant(): Acteur {
  const cle = cleRequete()
  if (!cle) return { id: null, impersonePar: null }
  let a = registre.get(cle)
  if (!a) {
    a = { id: null, impersonePar: null }
    registre.set(cle, a)
  }
  return a
}

export function definirActeur(id: string | null, impersonePar: string | null = null) {
  const a = acteurCourant()
  a.id = id
  a.impersonePar = impersonePar
}

/** En-têtes à joindre aux requêtes Supabase pour attribuer les écritures. */
export function entetesActeur(): Record<string, string> {
  const a = acteurCourant()
  if (!a.id) return {}
  return {
    'x-acteur-id': a.id,
    ...(a.impersonePar ? { 'x-acteur-impersone-par': a.impersonePar } : {}),
  }
}
