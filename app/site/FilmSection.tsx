'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, PleinEcran } from './icons'

/**
 * Film de présentation de l'accueil, en pleine largeur, sans texte autour :
 * le film porte ses propres messages. Il est muet : il part tout seul, en
 * boucle, quand la section arrive à l'écran, et se met en pause quand on la
 * quitte ; rien n'est téléchargé avant. Pause et plein écran restent à
 * portée (tout contenu animé de plus de 5 s doit pouvoir être arrêté).
 * Mouvement réduit ou économie de données : pas de lecture automatique,
 * l'affiche et un bouton lecture.
 */
export function FilmSection({ src, poster, titre }: { src: string; poster: string; titre: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const pauseVolontaire = useRef(false)
  const [enLecture, setEnLecture] = useState(false)
  const [lectureAuto, setLectureAuto] = useState<boolean | null>(null)

  useEffect(() => {
    const v = video.current
    if (!v) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const eco = Boolean((navigator as any).connection?.saveData)
    const auto = !reduit && !eco
    setLectureAuto(auto)

    const lance = () => setEnLecture(true)
    const arrete = () => setEnLecture(false)
    v.addEventListener('play', lance)
    v.addEventListener('pause', arrete)

    const observateur = new IntersectionObserver(([entree]) => {
      if (entree.isIntersecting) {
        if (auto && !pauseVolontaire.current) v.play().catch(() => { /* lecture refusée : bouton lecture */ })
      } else if (!v.paused) {
        v.pause()
      }
    }, { threshold: 0.4 })
    observateur.observe(v)

    return () => {
      observateur.disconnect()
      v.removeEventListener('play', lance)
      v.removeEventListener('pause', arrete)
    }
  }, [])

  function basculer() {
    const v = video.current
    if (!v) return
    if (v.paused) {
      pauseVolontaire.current = false
      v.play().catch(() => {})
    } else {
      pauseVolontaire.current = true
      v.pause()
    }
  }

  function pleinEcran() {
    const v: any = video.current
    if (!v) return
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {})
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen() // iPhone
  }

  const bouton = 'flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm ring-1 ring-white/15 transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5CD9A0]'

  return (
    <section aria-label={titre} className="relative bg-[#0B221B]">
      <h2 className="sr-only">{titre}</h2>
      <div className="group/film relative w-full aspect-video max-h-[100svh]">
        <video
          ref={video}
          src={src}
          poster={poster}
          preload="none"
          muted
          loop
          playsInline
          aria-label={titre}
          className="absolute inset-0 h-full w-full object-contain"
        />

        {lectureAuto === false && !enLecture && (
          <button
            type="button"
            onClick={basculer}
            aria-label={`Lire le film : ${titre}`}
            className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
          >
            <span className="flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-[#5CD9A0] text-[#0B221B] shadow-xl shadow-black/30 transition-transform duration-300 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#5CD9A0]/60">
              <Play className="h-9 w-9 md:h-10 md:w-10 translate-x-0.5" strokeWidth={2.2} />
            </span>
          </button>
        )}

        {/* En bas à gauche (le bouton WhatsApp flotte en bas à droite). Sur
            ordinateur, visibles au survol, au clavier ou en pause, pour ne
            pas masquer le texte du film ; toujours visibles au toucher. */}
        <div className={`absolute left-3 bottom-3 md:left-6 md:bottom-6 flex gap-2 transition-opacity duration-300 ${enLecture ? '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/film:opacity-100 focus-within:opacity-100' : ''}`}>
          <button type="button" onClick={basculer} aria-label={enLecture ? 'Mettre le film en pause' : 'Lire le film'} className={bouton}>
            {enLecture ? <Pause className="h-4 w-4" strokeWidth={2.2} /> : <Play className="h-4 w-4 translate-x-px" strokeWidth={2.2} />}
          </button>
          <button type="button" onClick={pleinEcran} aria-label="Voir le film en plein écran" className={bouton}>
            <PleinEcran className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  )
}
