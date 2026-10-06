'use client'

import Link from 'next/link'
import { ArrowRight } from '../icons'

/**
 * « Postuler à ce poste », sur chaque fiche de poste : le poste passe dans
 * l'adresse (le formulaire le reprend) et la page descend jusqu'au formulaire.
 * Le défilement est fait ici : avec `scroll={false}`, indispensable pour ne
 * pas remonter en haut de page, le routeur ne suit pas l'ancre.
 */
export function LienPostuler({ poste }: { poste: string }) {
  return (
    <Link
      href={`/recrutement?poste=${poste}#postuler`}
      scroll={false}
      onClick={() => document.getElementById('postuler')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#205040] px-5 text-sm font-semibold text-white hover:bg-[#1a4335] transition-colors"
    >
      Postuler à ce poste <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
