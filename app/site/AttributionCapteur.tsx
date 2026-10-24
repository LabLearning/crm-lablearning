'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { capterAttribution } from './attribution'
import { EVT_COOKIES_CHOISIS } from './CookieBanner'

/**
 * Retient la publicité d'arrivée (voir ./attribution) à chaque page vue, et
 * au moment où le visiteur donne son accord dans le bandeau. Ne rend rien.
 * L'adresse est lue dans window.location : useSearchParams obligerait à
 * rendre côté client toutes les pages statiques du site.
 */
export function AttributionCapteur() {
  const chemin = usePathname()
  useEffect(() => { capterAttribution() }, [chemin])
  useEffect(() => {
    window.addEventListener(EVT_COOKIES_CHOISIS, capterAttribution)
    return () => window.removeEventListener(EVT_COOKIES_CHOISIS, capterAttribution)
  }, [])
  return null
}
