'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { CLE_COOKIES, EVT_COOKIES_CHOISIS, accordCookies } from './CookieBanner'

/** Google Analytics 4 du site public (propriété fournie par Brahim le 24/10/2026). */
export const ID_GA4 = process.env.NEXT_PUBLIC_GA_ID || 'G-LJ1SBNWZJV'

/** Cookies de Google Analytics, effacés quand le visiteur retire son accord. */
function effacerCookiesGa() {
  const noms = document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => n === '_ga' || n.startsWith('_ga_'))
  const hote = window.location.hostname
  const domaines = ['', hote, `.${hote}`, `.${hote.split('.').slice(-2).join('.')}`]
  for (const nom of noms) {
    for (const d of domaines) document.cookie = `${nom}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`
  }
}

/**
 * Mesure d'audience du site (Google Analytics 4), chargée seulement avec
 * l'accord du visiteur pour cette finalité dans le bandeau cookies : sans
 * accord, aucun script Google n'est chargé et aucun cookie n'est posé.
 * Réglages : cookies limités à 13 mois (recommandation CNIL), pas de signaux
 * Google ni de personnalisation publicitaire, stockage publicitaire refusé
 * (mode consentement de Google). Retirer son accord coupe la mesure et efface
 * les cookies _ga aussitôt.
 */
export function MesureAudience() {
  const [accepte, setAccepte] = useState(false)
  // Jamais sur la page de désinscription : son adresse porte le jeton d'un destinataire
  const chemin = usePathname() || ''
  const exclue = /^\/(site\/)?desinscription(\/|$)/.test(chemin)

  useEffect(() => {
    const lire = () => {
      const oui = accordCookies('mesure')
      ;(window as any)[`ga-disable-${ID_GA4}`] = !oui
      if (!oui) {
        const gtag = (window as any).gtag
        if (typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: 'denied' })
        effacerCookiesGa()
      }
      setAccepte(oui)
    }
    lire()
    window.addEventListener(EVT_COOKIES_CHOISIS, lire)
    // Choix fait dans un autre onglet
    const surStockage = (e: StorageEvent) => { if (e.key === CLE_COOKIES) lire() }
    window.addEventListener('storage', surStockage)
    return () => {
      window.removeEventListener(EVT_COOKIES_CHOISIS, lire)
      window.removeEventListener('storage', surStockage)
    }
  }, [])

  if (!accepte || exclue) return null
  return (
    <>
      <Script id="ga4-reglages" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
gtag('js', new Date());
gtag('config', '${ID_GA4}', { cookie_expires: 34128000, allow_google_signals: false, allow_ad_personalization_signals: false });`}
      </Script>
      <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${ID_GA4}`} strategy="afterInteractive" />
    </>
  )
}
