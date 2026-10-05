'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const CLE = 'll_cookies_choix'
/** Événement global qui rouvre le bandeau (bouton « Modifier mon choix » de la page Cookies). */
export const EVT_GERER_COOKIES = 'll-gerer-cookies'

/**
 * Bandeau cookies RGPD : le choix est mémorisé en localStorage et le bandeau
 * ne revient plus — sauf demande explicite via l'événement EVT_GERER_COOKIES,
 * qui permet de retirer ou modifier son consentement à tout moment (exigence
 * RGPD). Le site n'embarque aujourd'hui que des cookies strictement
 * nécessaires — le consentement stocké servira de porte d'entrée si des
 * outils de mesure d'audience sont ajoutés plus tard.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CLE)) setVisible(true)
    } catch { /* stockage indisponible : pas de bandeau en boucle */ }
    const rouvrir = () => setVisible(true)
    window.addEventListener(EVT_GERER_COOKIES, rouvrir)
    return () => window.removeEventListener(EVT_GERER_COOKIES, rouvrir)
  }, [])

  function choisir(valeur: 'accepte' | 'refuse') {
    try { localStorage.setItem(CLE, valeur) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div role="dialog" aria-label="Gestion des cookies"
      className="fixed left-4 bottom-4 z-50 max-w-sm">
      <div className="rounded-2xl bg-[#14110F] text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 p-5">
        <p className="text-sm text-white/80 leading-relaxed">
          Ce site n&apos;utilise que des cookies strictement nécessaires à son fonctionnement.
          Votre choix ci-dessous vaudra pour d&apos;éventuelles mesures d&apos;audience anonymes à venir.{' '}
          <Link href="/cookies" className="underline underline-offset-2 text-white hover:text-white/80">
            En savoir plus
          </Link>
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => choisir('accepte')}
            className="px-5 py-2 rounded-full bg-white text-[#14110F] text-sm font-semibold hover:bg-[#F6F4EF] transition-colors">
            Accepter
          </button>
          <button onClick={() => choisir('refuse')}
            className="px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-colors">
            Sans accepter
          </button>
        </div>
      </div>
    </div>
  )
}
