'use client'

import { useEffect, useRef, useState } from 'react'
import { Play } from './icons'
import { Kicker } from './Kicker'

export interface ChapitreFilm { t: number; titre: string }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * Film de présentation de l'accueil : titre et chapitres à gauche, film à
 * droite (titre, film puis chapitres sur mobile). Rien n'est chargé avant le
 * premier clic (preload="none"). Un chapitre lance le film à son début, et
 * le chapitre en cours s'allume pendant la lecture, avec sa progression.
 * Le film est muet : lecture muette, jamais bloquée par le navigateur.
 */
export function FilmSection({ src, poster, duree, chapitres }: {
  src: string
  poster: string
  /** Durée affichée, par exemple « 1 min 14 ». */
  duree: string
  /** Débuts de séquence en secondes, dans l'ordre : à recaler à chaque nouvelle version du film. */
  chapitres: ChapitreFilm[]
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [lance, setLance] = useState(false)
  const [temps, setTemps] = useState(0)
  const [fin, setFin] = useState(0)

  useEffect(() => {
    const v = video.current
    if (!v) return
    const maj = () => setTemps(v.currentTime)
    const meta = () => setFin(v.duration || 0)
    v.addEventListener('timeupdate', maj)
    v.addEventListener('loadedmetadata', meta)
    return () => {
      v.removeEventListener('timeupdate', maj)
      v.removeEventListener('loadedmetadata', meta)
    }
  }, [])

  function lire(depuis?: number) {
    const v = video.current
    if (!v) return
    setLance(true)
    if (depuis != null) {
      // Avant le chargement des métadonnées, la position demandée serait ignorée
      if (v.readyState >= 1) v.currentTime = depuis
      else v.addEventListener('loadedmetadata', () => { v.currentTime = depuis }, { once: true })
      setTemps(depuis)
    }
    v.play().catch(() => { /* lecture refusée : les contrôles restent disponibles */ })
  }

  const actif = lance ? chapitres.reduce((k, c, i) => (temps >= c.t ? i : k), -1) : -1
  const progression = (i: number) => {
    const debut = chapitres[i].t
    const suite = chapitres[i + 1]?.t ?? (fin || debut + 10)
    return Math.min(1, Math.max(0, (temps - debut) / (suite - debut)))
  }

  return (
    <section className="relative overflow-hidden bg-[#0B221B] py-16 md:py-24">
      {/* Halo menthe discret derrière le film */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/2 h-[560px] w-[760px] -translate-y-1/2 rounded-full blur-3xl opacity-50"
        style={{ background: 'radial-gradient(closest-side, rgba(92,217,160,0.28), transparent)' }}
      />

      <div className="relative max-w-6xl mx-auto px-5 md:px-8 grid gap-8 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-8">
        <div className="lg:col-start-1 lg:col-span-4 lg:row-start-1 lg:self-end">
          <Kicker tone="light" className="mb-4">Découvrir Lab Learning</Kicker>
          <h2 className="ll-display ll-fluid-h2 text-white tracking-heading text-balance">
            Lab Learning <span className="text-[#5CD9A0]">en une minute</span>
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Nos métiers, notre façon de former sur le terrain et nos résultats, en images.
          </p>
        </div>

        <div className="lg:col-start-5 lg:col-span-8 lg:row-start-1 lg:row-span-2 lg:self-center">
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-[#07170F] ring-1 ring-white/10 shadow-2xl shadow-black/50">
            <video
              ref={video}
              src={src}
              poster={poster}
              preload="none"
              playsInline
              muted
              controls={lance}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {!lance && (
              <button
                type="button"
                onClick={() => lire()}
                aria-label={`Voir le film de présentation (${duree})`}
                className="group absolute inset-0 text-left focus-visible:outline-none"
              >
                <span className="absolute inset-0 bg-gradient-to-t from-[#07170F]/75 via-[#07170F]/5 to-transparent" />
                <span className="absolute left-4 bottom-4 md:left-6 md:bottom-6 inline-flex items-center gap-3 rounded-full bg-white/95 py-1.5 pl-1.5 pr-5 shadow-xl shadow-black/30 transition-transform duration-300 group-hover:scale-[1.03] group-focus-visible:ring-[3px] group-focus-visible:ring-[#5CD9A0]">
                  <span className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full bg-[#5CD9A0] text-[#0B221B]">
                    <Play className="h-5 w-5 translate-x-px" strokeWidth={2.4} />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-[#0B221B]">Voir le film</span>
                    <span className="block font-mono text-[11px] text-[#57534E] tabular-nums">{duree}</span>
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        <ol className="lg:col-start-1 lg:col-span-4 lg:row-start-2 lg:self-start border-t border-white/10" aria-label="Chapitres du film">
          {chapitres.map((c, i) => {
            const enCours = i === actif
            return (
              <li key={c.t} className="relative border-b border-white/10">
                <button
                  type="button"
                  onClick={() => lire(c.t)}
                  aria-current={enCours ? 'true' : undefined}
                  className={`group flex w-full items-center gap-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5CD9A0]/70 rounded-md ${enCours ? 'text-white' : 'text-white/60 hover:text-white'}`}
                >
                  <span className={`w-10 shrink-0 font-mono text-xs tabular-nums ${enCours ? 'text-[#5CD9A0]' : 'text-white/35 group-hover:text-[#5CD9A0]'}`}>{mmss(c.t)}</span>
                  <span className="flex-1 text-sm font-medium">{c.titre}</span>
                  <Play className={`h-3.5 w-3.5 shrink-0 transition-opacity ${enCours ? 'opacity-100 text-[#5CD9A0]' : 'opacity-0 group-hover:opacity-60'}`} strokeWidth={2.4} />
                </button>
                {enCours && (
                  <span aria-hidden="true" className="absolute -bottom-px left-0 h-px bg-[#5CD9A0]" style={{ width: `${progression(i) * 100}%` }} />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
