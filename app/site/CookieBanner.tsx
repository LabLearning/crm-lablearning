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
/**
 * Version du texte du bandeau auquel le visiteur a répondu : un accord ne vaut
 * que pour ce qu'il annonçait. 2 (24/10/2026) : deux finalités, acceptées
 * ensemble ou séparément (mesure d'audience, publicité d'arrivée) ; avant,
 * Google Analytics seul, sans version enregistrée.
 */
const CLE_VERSION = 'll_cookies_version'
const VERSION_CHOIX = '2'

/** Les deux finalités soumises à l'accord du visiteur. */
export interface ChoixCookies {
  /** Mesure d'audience (Google Analytics, MesureAudience) */
  mesure: boolean
  /** Publicité ou lien d'arrivée joint à une demande (./attribution) */
  attribution: boolean
}

/** Le choix du visiteur s'il date de moins de six mois et répond au texte actuel, sinon null (le bandeau revient). */
export function choixCookies(): ChoixCookies | null {
  try {
    const le = Number(localStorage.getItem(CLE_DATE) || 0)
    // Choix donné à un texte plus ancien du bandeau : il ne vaut pas pour l'actuel, on redemande
    if (!le || localStorage.getItem(CLE_VERSION) !== VERSION_CHOIX || Date.now() - le > VALIDITE_CHOIX_MS) return null
    const brut = JSON.parse(localStorage.getItem(CLE) || 'null')
    if (!brut || typeof brut !== 'object') return null
    return { mesure: brut.mesure === 1, attribution: brut.attribution === 1 }
  } catch {
    return null
  }
}

/** Accord donné pour une finalité (faux tant que le visiteur n'a pas répondu). */
export function accordCookies(finalite: keyof ChoixCookies): boolean {
  return choixCookies()?.[finalite] === true
}

/**
 * Bandeau cookies RGPD. Deux finalités, acceptées ou refusées ensemble, ou
 * choisies une par une (« Choisir ») : la mesure d'audience de Google
 * Analytics (MesureAudience) et la publicité d'arrivée jointe à une demande
 * (./attribution). Ni l'une ni l'autre sans accord. Le choix est mémorisé
 * en localStorage pour six mois ; l'événement EVT_GERER_COOKIES rouvre le
 * bandeau pour le modifier ou le retirer à tout moment (exigence RGPD).
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [details, setDetails] = useState(false)
  const [mesure, setMesure] = useState(false)
  const [attribution, setAttribution] = useState(false)

  useEffect(() => {
    try {
      if (!choixCookies()) setVisible(true)
    } catch { /* stockage indisponible : pas de bandeau en boucle */ }
    const rouvrir = () => {
      // Le détail repart du choix en cours, pour le modifier ou le retirer
      const c = choixCookies()
      setMesure(!!c?.mesure)
      setAttribution(!!c?.attribution)
      setDetails(false)
      setVisible(true)
    }
    window.addEventListener(EVT_GERER_COOKIES, rouvrir)
    return () => window.removeEventListener(EVT_GERER_COOKIES, rouvrir)
  }, [])

  function enregistrer(c: ChoixCookies) {
    try {
      localStorage.setItem(CLE, JSON.stringify({ mesure: c.mesure ? 1 : 0, attribution: c.attribution ? 1 : 0 }))
      localStorage.setItem(CLE_DATE, String(Date.now()))
      localStorage.setItem(CLE_VERSION, VERSION_CHOIX)
    } catch { /* ignore */ }
    setVisible(false)
    setDetails(false)
    // La bulle Starkk attend ce choix sur téléphone : le bandeau occupe sa place
    window.dispatchEvent(new Event(EVT_COOKIES_CHOISIS))
  }

  if (!visible) return null

  const bouton = 'px-4 py-2 rounded-full text-sm font-semibold transition-colors'
  const interrupteur = (actif: boolean, changer: (v: boolean) => void, titre: string, detail: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <input type="checkbox" checked={actif} onChange={(e) => changer(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#5CD9A0]" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{titre}</span>
        <span className="block text-xs leading-relaxed text-white/70">{detail}</span>
      </span>
    </label>
  )

  return (
    <div role="dialog" aria-label="Gestion des cookies"
      className="fixed left-4 bottom-4 z-50 max-w-sm max-sm:right-4">
      <div className="rounded-2xl bg-[#14110F] text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 p-5">
        <p className="text-sm text-white/80 leading-relaxed">
          Avec votre accord, nous mesurons l&apos;audience du site (Google Analytics) et, si vous nous écrivez, nous joignons
          à votre demande la publicité ou le lien qui vous a amené, pour savoir quelles annonces nous amènent des demandes.
          Aucun cookie publicitaire. Sans accord, seuls les cookies nécessaires au site sont utilisés.{' '}
          <Link href="/cookies" className="underline underline-offset-2 text-white hover:text-white/80">
            En savoir plus
          </Link>
        </p>
        {details && (
          <div className="mt-4 space-y-2">
            {interrupteur(mesure, setMesure, 'Mesure d’audience', 'Google Analytics compte les visites et les pages lues, sans publicité.')}
            {interrupteur(attribution, setAttribution, 'Publicité d’arrivée', 'Si vous nous écrivez, la publicité ou le lien qui vous a amené est joint à votre demande.')}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {details ? (
            <button onClick={() => enregistrer({ mesure, attribution })}
              className={`${bouton} bg-white text-[#14110F] hover:bg-[#F6F4EF]`}>
              Enregistrer mes choix
            </button>
          ) : (
            <>
              <button onClick={() => enregistrer({ mesure: true, attribution: true })}
                className={`${bouton} bg-white text-[#14110F] hover:bg-[#F6F4EF]`}>
                Tout accepter
              </button>
              <button onClick={() => enregistrer({ mesure: false, attribution: false })}
                className={`${bouton} bg-white text-[#14110F] hover:bg-[#F6F4EF]`}>
                Tout refuser
              </button>
              <button onClick={() => setDetails(true)}
                className={`${bouton} font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40`}>
                Choisir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
