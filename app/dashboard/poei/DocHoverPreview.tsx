'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Loader2, FileQuestion } from 'lucide-react'

/**
 * Aperçu rapide d'un document au survol du bouton « œil ».
 *
 * Le popover s'ouvre au-dessus ou en dessous du bouton (jamais sur le côté)
 * selon la place disponible, et se rend dans un portail pour échapper aux
 * conteneurs à overflow masqué. Le clic conserve le comportement normal
 * (ouverture dans un onglet) — utile sur tablette où le survol n'existe pas.
 */
export function DocHoverPreview({
  docId,
  mimeType,
  fileName,
}: {
  docId: string
  mimeType: string | null
  fileName: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null)
  const anchorRef = useRef<HTMLAnchorElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isImage = (mimeType || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(fileName || '')
  const isPdf = (mimeType || '') === 'application/pdf' || /\.pdf$/i.test(fileName || '')
  const previewable = isImage || isPdf
  const url = `/api/documents/${docId}/download?inline=1`

  const W = 320   // largeur du popover
  const H = 380   // hauteur de l'aperçu

  function show() {
    if (!previewable) return
    timer.current = setTimeout(() => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      const placement: 'above' | 'below' = spaceBelow > H + 24 ? 'below' : 'above'
      // Centré sur le bouton, borné pour ne jamais déborder de l'écran
      const left = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8)
      const top = placement === 'below' ? r.bottom + 8 : r.top - 8
      setPos({ top, left, placement })
      setOpen(true)
    }, 350)
  }

  function hide() {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <a
      ref={anchorRef}
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Visualiser"
      onMouseEnter={show}
      onMouseLeave={hide}
      className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 shrink-0"
    >
      <Eye className="h-4 w-4" />

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[60] w-80 rounded-xl border border-surface-200 bg-white shadow-2xl overflow-hidden animate-fade-in"
          style={{
            left: pos.left,
            top: pos.placement === 'below' ? pos.top : undefined,
            bottom: pos.placement === 'above' ? window.innerHeight - pos.top : undefined,
          }}
        >
          <div className="px-3 py-2 border-b border-surface-100 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-surface-400 shrink-0" />
            <span className="text-xs font-medium text-surface-600 truncate">{fileName || 'Aperçu'}</span>
          </div>
          <div className="relative bg-surface-50" style={{ height: H }}>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={fileName || ''} className="h-full w-full object-contain" />
            ) : isPdf ? (
              <iframe
                src={`${url}#toolbar=0&navpanes=0&statusbar=0&view=FitH`}
                title={fileName || 'Aperçu PDF'}
                className="h-full w-full"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-surface-400">
                <FileQuestion className="h-8 w-8" />
                <span className="text-xs">Aperçu non disponible</span>
              </div>
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-surface-100 text-[10px] text-surface-400 text-center">
            Cliquer pour ouvrir en plein écran
          </div>
        </div>,
        document.body,
      )}
    </a>
  )
}
