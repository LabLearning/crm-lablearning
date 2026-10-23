'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, FileText } from '@/components/ui/icons'

/**
 * Aperçu d'un PDF dans la page, page après page, dans un cadre qui défile.
 *
 * Pas de visionneuse du navigateur : un PDF placé dans un cadre ne s'affiche
 * pas sur Android et seulement sa première page sur iPhone. Les pages sont
 * dessinées par PDF.js (celui qu'embarque unpdf), chargé à la demande. Le
 * document vient de la même adresse que le lien « ouvrir », qui note la
 * consultation au dossier de preuve : l'afficher ici vaut ouverture.
 *
 * `onCharge` est appelé dès que la première page est à l'écran.
 */
export function ApercuPdf({ url, titre, onCharge, onEchec }: {
  url: string
  /** Nom du document, pour les lecteurs d'écran et les messages */
  titre: string
  onCharge?: () => void
  onEchec?: () => void
}) {
  const zone = useRef<HTMLDivElement>(null)
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement')
  const [nbPages, setNbPages] = useState(0)

  useEffect(() => {
    let annule = false
    const cible = zone.current
    ;(async () => {
      try {
        // PDF.js 5 appelle des fonctions récentes que son paquet ne complète pas
        // (Safari et Chrome d'avant 2025) : des versions simples suffisent à l'affichage
        if (typeof (Math as any).sumPrecise !== 'function') {
          ;(Math as any).sumPrecise = (valeurs: Iterable<number>) => { let s = 0; for (const v of valeurs) s += v; return s }
        }
        if (typeof (Uint8Array.prototype as any).toBase64 !== 'function') {
          Object.defineProperty(Uint8Array.prototype, 'toBase64', {
            value(this: Uint8Array) { let s = ''; for (let i = 0; i < this.length; i += 0x8000) s += String.fromCharCode(...Array.from(this.subarray(i, i + 0x8000))); return btoa(s) },
            writable: true, configurable: true,
          })
        }
        if (typeof (Uint8Array as any).fromBase64 !== 'function') {
          Object.defineProperty(Uint8Array, 'fromBase64', {
            value(b64: string) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out },
            writable: true, configurable: true,
          })
        }
        const [{ getDocumentProxy }, reponse] = await Promise.all([
          import('unpdf'),
          fetch(url, { credentials: 'same-origin', cache: 'no-store' }),
        ])
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
        const type = reponse.headers.get('content-type') || ''
        if (!type.includes('pdf')) throw new Error('Réponse sans PDF')
        const doc = await getDocumentProxy(new Uint8Array(await reponse.arrayBuffer()))
        if (annule || !cible) return
        setNbPages(doc.numPages)
        cible.replaceChildren()
        const largeur = Math.max(280, cible.clientWidth - 24)
        const densite = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= doc.numPages; n++) {
          if (annule) return
          const page = await doc.getPage(n)
          const echelle = (largeur / page.getViewport({ scale: 1 }).width) * densite
          const vue = page.getViewport({ scale: echelle })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(vue.width)
          canvas.height = Math.floor(vue.height)
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.className = 'block bg-white rounded-md shadow-sm ring-1 ring-black/10'
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `${titre}, page ${n} sur ${doc.numPages}`)
          cible.appendChild(canvas)
          const contexte = canvas.getContext('2d')
          if (!contexte) throw new Error('Canvas indisponible')
          await page.render({ canvas, canvasContext: contexte, viewport: vue } as any).promise
          if (n === 1 && !annule) { setEtat('pret'); onCharge?.() }
        }
      } catch (e) {
        console.error('[aperçu PDF]', e)
        if (!annule) { setEtat('erreur'); onEchec?.() }
      }
    })()
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-100">
      <div className="flex items-center justify-between gap-3 border-b border-surface-200 px-3 py-2 text-xs text-surface-600">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <FileText className="h-3.5 w-3.5" />
          {etat === 'pret' && nbPages > 0 ? `${nbPages} page${nbPages > 1 ? 's' : ''} · faites défiler pour tout lire` : titre}
        </span>
        <a href={url} target="_blank" rel="noreferrer" onClick={() => onCharge?.()}
          className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-600 hover:underline">
          Plein écran <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="relative">
        <div ref={zone} className="flex h-[60vh] max-h-[640px] min-h-[320px] flex-col gap-3 overflow-y-auto overscroll-contain p-3" tabIndex={0} aria-label={titre} />
        {etat === 'chargement' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-surface-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement du document…
          </div>
        )}
        {etat === 'erreur' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-surface-600">
            L&apos;aperçu ne peut pas s&apos;afficher sur cet appareil.
            <a href={url} target="_blank" rel="noreferrer" onClick={() => onCharge?.()} className="btn-secondary inline-flex items-center gap-2">
              <FileText className="h-4 w-4" /> Ouvrir le document (PDF)
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
