'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, X } from './icons'
import { BANDEAU } from './bandeau'

const CLE = 'll_bandeau_ferme'

/**
 * Bandeau d'information au-dessus du menu (message dans ./bandeau.ts). Il
 * défile avec la page : le menu, lui, reste collé en haut. Le visiteur peut le
 * fermer ; son choix est gardé sur son appareil, pour ce message seulement.
 */
export function SiteBandeau() {
  // Sur lab-learning.fr l'adresse est propre (/modeles) ; hors du domaine public la même page vit sous /site
  const pathname = (usePathname() || '/').replace(/^\/site(?=\/|$)/, '') || '/'
  const [ferme, setFerme] = useState(false)

  useEffect(() => {
    try { if (window.localStorage.getItem(CLE) === BANDEAU.id) setFerme(true) } catch { /* stockage indisponible : le bandeau reste affiché */ }
  }, [])

  const perime = !!BANDEAU.jusquAu && new Date().toISOString().slice(0, 10) > BANDEAU.jusquAu
  // Inutile d'annoncer une page à celui qui s'y trouve déjà
  const surPlace = !!BANDEAU.lien && (pathname === BANDEAU.lien.href || pathname.startsWith(`${BANDEAU.lien.href}/`))
  if (!BANDEAU.actif || perime || ferme || surPlace) return null

  function fermer() {
    setFerme(true)
    try { window.localStorage.setItem(CLE, BANDEAU.id) } catch { /* sans stockage, il reviendra à la prochaine visite */ }
  }

  return (
    <div className="bg-[#205040] text-white" role="region" aria-label="Information">
      <div className="max-w-6xl mx-auto px-5 md:px-8 min-h-10 py-2 flex items-center gap-3 text-sm">
        {/* Téléphone : une seule ligne, tout le message est le lien */}
        <div className="min-w-0 flex-1 sm:hidden">
          {BANDEAU.lien ? (
            <Link href={BANDEAU.lien.href} className="inline-flex max-w-full items-center gap-1.5 font-semibold text-white">
              <span className="truncate">{BANDEAU.texteCourt || BANDEAU.texte}</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ) : <span className="text-white/90">{BANDEAU.texteCourt || BANDEAU.texte}</span>}
        </div>
        <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center sm:flex">
          {BANDEAU.etiquette && <span className="rounded-full bg-[#5CD9A0] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0F2A22]">{BANDEAU.etiquette}</span>}
          <span className="text-white/90">{BANDEAU.texte}</span>
          {BANDEAU.lien && (
            <Link href={BANDEAU.lien.href} className="group inline-flex items-center gap-1 font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
              {BANDEAU.lien.libelle} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
        <button type="button" onClick={fermer} aria-label="Fermer ce message" className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
