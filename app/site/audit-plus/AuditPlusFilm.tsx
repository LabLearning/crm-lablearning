'use client'

import { useRef, useState } from 'react'
import { Play } from '../icons'

/**
 * Vidéo de présentation d'Audit+ (avec le son) : affiche et bouton lecture,
 * rien n'est chargé avant le clic, puis la vidéo part avec le son, ce que les
 * navigateurs n'autorisent qu'après une action de l'utilisateur.
 */
export function AuditPlusFilm({ src, poster, duree }: { src: string; poster: string; duree: string }) {
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
    <div id="film" className="relative aspect-video overflow-hidden rounded-3xl bg-[#07170F] ring-1 ring-white/10 shadow-2xl shadow-black/40 scroll-mt-24">
      <video
        ref={video}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls={lance}
        aria-label="Présentation d’Audit+"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {!lance && (
        <button
          type="button"
          onClick={lire}
          aria-label={`Lire la présentation d’Audit+ (${duree}, avec le son)`}
          className="group absolute inset-0 text-left focus-visible:outline-none"
        >
          <span className="absolute inset-0 bg-gradient-to-t from-[#07170F]/70 via-transparent to-transparent" />
          <span className="absolute left-4 bottom-4 md:left-6 md:bottom-6 inline-flex items-center gap-3 rounded-full bg-white/95 py-1.5 pl-1.5 pr-5 shadow-xl shadow-black/30 transition-transform duration-300 group-hover:scale-[1.03] group-focus-visible:ring-[3px] group-focus-visible:ring-[#5CD9A0]">
            <span className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full bg-[#5CD9A0] text-[#0B221B]">
              <Play className="h-5 w-5 translate-x-px" strokeWidth={2.4} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-[#0B221B]">Voir la présentation</span>
              <span className="block font-mono text-[11px] text-[#57534E] tabular-nums">{duree} · avec le son</span>
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
