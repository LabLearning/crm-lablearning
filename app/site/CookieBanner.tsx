'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const CLE = 'll_cookies_choix'
/** Événement global qui rouvre le bandeau (bouton « Modifier mon choix » de la page Cookies). */
export const EVT_GERER_COOKIES = 'll-gerer-cookies'
/** Émis quand le visiteur a répondu au bandeau. */
export const EVT_COOKIES_CHOISIS = 'll-cookies-choisis'
/** Clé du choix mémorisé. */
export const CLE_COOKIES = 'll_cookies_choix'
/** Date du choix : il est redemandé au bout de six mois (recommandation de la CNIL). */
const CLE_DATE = 'll_cookies_le'
const VALIDITE_CHOIX_MS = 182 * 86400000

/** Le choix du visiteur s'il date de moins de six mois, sinon null (le bandeau revient). */
export function choixCookiesValide(): 'accepte' | 'refuse' | null {
  try {
    const choix = localStorage.getItem(CLE)
    if (choix !== 'accepte' && choix !== 'refuse') return null
    const le = Number(localStorage.getItem(CLE_DATE) || 0)
    // Choix fait avant le 24/10/2026 (sans date) : le bandeau annonçait alors une mesure
    // « anonyme à venir », pas Google Analytics. Cet accord ne vaut pas : on redemande.
    if (!le) return null
    return Date.now() - le > VALIDITE_CHOIX_MS ? null : choix
  } catch {
    return null
  }
}

/**
 * Bandeau cookies RGPD : le choix est mémorisé en localStorage pour six mois et le bandeau
 * ne revient plus — sauf demande explicite via l'événement EVT_GERER_COOKIES,
 * qui permet de retirer ou modifier son consentement à tout moment (exigence
 * RGPD). Accepter autorise la mesure d'audience de Google Analytics
 * (MesureAudience), qui n'est pas chargée sans cet accord.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!choixCookiesValide()) setVisible(true)
    } catch { /* stockage indisponible : pas de bandeau en boucle */ }
    const rouvrir = () => setVisible(true)
    window.addEventListener(EVT_GERER_COOKIES, rouvrir)
    return () => window.removeEventListener(EVT_GERER_COOKIES, rouvrir)
  }, [])

  function choisir(valeur: 'accepte' | 'refuse') {
    try { localStorage.setItem(CLE, valeur); localStorage.setItem(CLE_DATE, String(Date.now())) } catch { /* ignore */ }
    setVisible(false)
    // La bulle Starkk attend ce choix sur téléphone : le bandeau occupe sa place
    window.dispatchEvent(new Event(EVT_COOKIES_CHOISIS))
  }

  if (!visible) return null

  return (
    <div role="dialog" aria-label="Gestion des cookies"
      className="fixed left-4 bottom-4 z-50 max-w-sm">
      <div className="rounded-2xl bg-[#14110F] text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 p-5">
        <p className="text-sm text-white/80 leading-relaxed">
          Avec votre accord, nous mesurons l&apos;audience du site avec Google Analytics, pour savoir quelles pages vous sont utiles.
          Aucun cookie publicitaire. Sans accord, seuls les cookies nécessaires au site sont utilisés.{' '}
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
