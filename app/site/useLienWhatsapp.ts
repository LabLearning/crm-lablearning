'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { lienWhatsapp } from './whatsapp'

const MESSAGE = 'Bonjour, je souhaite des informations sur vos formations.'

/** Lien WhatsApp du site : sur une fiche formation, le premier message cite la formation. */
export function useLienWhatsapp() {
  const chemin = usePathname()
  const [lien, setLien] = useState(lienWhatsapp(MESSAGE))

  useEffect(() => {
    const titre = /\/formations\/[^/]+/.test(chemin || '')
      ? document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()
      : null
    setLien(lienWhatsapp(titre ? `Bonjour, je souhaite des informations sur la formation « ${titre} ».` : MESSAGE))
  }, [chemin])

  return lien
}
