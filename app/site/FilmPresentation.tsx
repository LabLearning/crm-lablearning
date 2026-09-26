'use client'

import { useRef, useState } from 'react'
import { Play } from './icons'

/**
 * Film de présentation Lab Learning : affiche + bouton lecture. Rien n'est
 * chargé avant le clic (preload="none"), puis la vidéo part avec le son, ce
 * que les navigateurs n'autorisent qu'après une action de l'utilisateur.
 */
export function FilmPresentation({ src, poster, duree }: { src: string; poster: string; duree: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [lance, setLance] = useState(false)

  function lire() {
    setLance(true)
    const v = video.current
    if (!v) return
    v.muted = false
    v.play().catch(() => { /* lecture bloquée : les contrôles restent disponibles */ })
  }

  return (
    <div className="relative aspect-video rounded-[28px] overflow-hidden bg-[#07170F] ring-1 ring-white/10 shadow-2xl shadow-black/40">
      <video
        ref={video}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls={lance}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {!lance && (
        <button
          type="button"
          onClick={lire}
          aria-label={`Lire le film de présentation (${duree}, avec le son)`}
          className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
        >
          <span className="absolute inset-0 bg-gradient-to-t from-[#07170F]/70 via-[#07170F]/10 to-transparent" />
          <span className="relative flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-full bg-[#5CD9A0] text-[#07170F] shadow-xl shadow-black/30 transition-transform duration-300 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#5CD9A0]/60">
            <span className="ll-film-pulse absolute inset-0 rounded-full bg-[#5CD9A0]/40" aria-hidden="true" />
            <Play className="relative h-10 w-10 md:h-12 md:w-12 translate-x-0.5" strokeWidth={2.2} />
          </span>
          <span className="absolute left-5 bottom-5 md:left-8 md:bottom-7 text-left">
            <span className="block text-white font-heading font-black text-lg md:text-2xl tracking-tight">Lab Learning en {duree}</span>
            <span className="block text-white/70 text-xs md:text-sm mt-0.5">Avec le son</span>
          </span>
        </button>
      )}
    </div>
  )
}
