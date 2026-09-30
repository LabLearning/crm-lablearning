'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Whatsapp } from './icons'
import { lienWhatsapp } from './whatsapp'

const MESSAGE = 'Bonjour, je souhaite des informations sur vos formations.'

/**
 * Bouton flottant WhatsApp, en bas à droite de toutes les pages du site.
 * Sur une fiche formation, le premier message cite la formation. Le bandeau
 * cookies (z-50) passe au-dessus tant qu'il est ouvert.
 */
export function WhatsappBouton() {
  const chemin = usePathname()
  const [lien, setLien] = useState(lienWhatsapp(MESSAGE))

  useEffect(() => {
    const titre = /\/formations\/[^/]+/.test(chemin || '')
      ? document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()
      : null
    setLien(lienWhatsapp(titre ? `Bonjour, je souhaite des informations sur la formation « ${titre} ».` : MESSAGE))
  }, [chemin])

  return (
    <a
      href={lien}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Écrire à Lab Learning sur WhatsApp (nouvelle fenêtre)"
      className="group fixed right-4 bottom-4 md:right-6 md:bottom-6 z-40 flex items-center gap-3 focus-visible:outline-none"
    >
      <span className="pointer-events-none hidden md:block translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#14110F] shadow-lg shadow-black/10 ring-1 ring-black/5 whitespace-nowrap">
        Écrivez-nous sur WhatsApp
      </span>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#0B221B]/25 ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105 group-focus-visible:ring-[3px] group-focus-visible:ring-[#5CD9A0]">
        <Whatsapp className="h-7 w-7" strokeWidth={1.8} />
      </span>
    </a>
  )
}
