'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Recharge les données de la page (router.refresh) à intervalle régulier tant
 * que l'onglet est visible, et dès qu'on y revient. Sert en salle : un
 * questionnaire ouvert par le formateur apparaît sur le téléphone du stagiaire
 * sans qu'il ait à recharger, et les réponses arrivent sur l'écran du formateur.
 * L'état des composants clients (saisie en cours…) est conservé.
 */
export function RafraichissementAuto({ secondes = 15 }: { secondes?: number }) {
  const router = useRouter()
  useEffect(() => {
    const rafraichir = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = window.setInterval(rafraichir, secondes * 1000)
    document.addEventListener('visibilitychange', rafraichir)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', rafraichir)
    }
  }, [router, secondes])
  return null
}
