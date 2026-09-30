'use client'

import { useEffect, useRef, useState } from 'react'
import { Sandwich, MapPin } from './icons'

/** Formations qui défilent sur la carte « Formation », comme dans le film. */
const FORMATIONS = [
  'Hygiène alimentaire (HACCP)',
  'Management d’équipe',
  'Accueil et relation client',
  'Prévention des risques (DUERP)',
]

/**
 * Visuel du haut de l'accueil : un formateur en plein fast-food (vidéo
 * courte en boucle, muette) et trois cartes qui flottent autour, pour dire
 * d'un coup d'œil qu'on forme la restauration rapide, sur place. La vidéo ne
 * tourne que visible à l'écran ; mouvement réduit : image fixe, cartes
 * immobiles, titre de formation fixe.
 */
export function HeroTerrain({ video, poster }: { video: string; poster: string }) {
  const lecteur = useRef<HTMLVideoElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const v = lecteur.current
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!v || reduit) return
    const observateur = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => { /* affiche fixe */ })
      else v.pause()
    }, { threshold: 0.2 })
    observateur.observe(v)
    const minuteur = setInterval(() => setIndex((i) => (i + 1) % FORMATIONS.length), 2600)
    return () => { observateur.disconnect(); clearInterval(minuteur) }
  }, [])

  const carte = 'rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl shadow-[#0B221B]/15 ring-1 ring-black/5'

  return (
    <div className="relative mx-auto w-full max-w-[440px] sm:max-w-[480px] lg:max-w-none px-4 sm:px-8 lg:px-10">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-[#0B221B] ring-1 ring-black/5 shadow-2xl shadow-[#0B221B]/25">
        <video
          ref={lecteur}
          src={video}
          poster={poster}
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Un formateur Lab Learning forme une équipière à l’assemblage, en cuisine de restauration rapide"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B221B]/35 via-transparent to-transparent" />
      </div>

      {/* Spécialité */}
      <div className="absolute left-0 top-6 sm:top-10 ll-carte-entree" style={{ animationDelay: '.35s' }}>
        <div className={`ll-carte-flotte ${carte} flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3`} style={{ animationDuration: '6.5s' }}>
          <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-[#205040] text-[#5CD9A0]">
            <Sandwich className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#205040]">Spécialiste</span>
            <span className="block font-heading font-bold text-[13px] sm:text-[15px] text-[#14110F]">Restauration rapide</span>
          </span>
        </div>
      </div>

      {/* Formations qui défilent */}
      <div className="absolute right-0 top-[44%] ll-carte-entree" style={{ animationDelay: '.6s' }}>
        <div className={`ll-carte-flotte ${carte} w-[164px] sm:w-[220px] px-3 py-2.5 sm:px-4 sm:py-3.5`} style={{ animationDuration: '7s', animationDelay: '-2s' }}>
          <span className="inline-flex rounded-full bg-[#5CD9A0]/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#205040]">Formation</span>
          <span key={index} className="ll-titre-defile mt-1.5 sm:mt-2 block min-h-[2.25rem] sm:min-h-[2.5rem] font-heading font-bold text-[13px] sm:text-[15px] leading-snug text-[#14110F]">
            {FORMATIONS[index]}
          </span>
          <span className="mt-2 flex gap-1" aria-hidden="true">
            {FORMATIONS.map((f, i) => (
              <span key={f} className={`h-1 rounded-full transition-all duration-500 ${i === index ? 'w-5 bg-[#205040]' : 'w-1.5 bg-[#205040]/20'}`} />
            ))}
          </span>
        </div>
      </div>

      {/* Sur place */}
      <div className="absolute left-0 bottom-8 sm:bottom-12 ll-carte-entree" style={{ animationDelay: '.85s' }}>
        <div className={`ll-carte-flotte ${carte} flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 sm:px-4 sm:py-3`} style={{ animationDuration: '6s', animationDelay: '-4s' }}>
          <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-[#5CD9A0]/20 text-[#205040]">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-heading font-bold text-[13px] sm:text-[15px] text-[#14110F]">Le formateur vient chez vous</span>
            <span className="block text-[11px] sm:text-xs text-[#57534E]">Sur votre poste, sans fermer</span>
          </span>
        </div>
      </div>
    </div>
  )
}
