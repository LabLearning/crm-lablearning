'use client'

import { useRef, useState, useEffect } from 'react'
import { Check, RotateCcw, X, Loader2 } from 'lucide-react'

interface SignaturePadProps {
  title: string
  subtitle?: string
  onSign: (signatureBase64: string) => void
  onCancel: () => void
  isPending: boolean
  validateLabel?: string
}

export function SignaturePad({
  title,
  subtitle,
  onSign,
  onCancel,
  isPending,
  validateLabel = 'Valider la signature',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)

    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 40)
    ctx.lineTo(rect.width - 20, rect.height - 40)
    ctx.stroke()

    ctx.fillStyle = '#a1a1aa'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('Signez ici', 20, rect.height - 48)

    ctx.strokeStyle = '#1C1917'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    setIsDrawing(true)
    setHasDrawn(true)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw() {
    setIsDrawing(false)
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.save()
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 40)
    ctx.lineTo(rect.width - 20, rect.height - 40)
    ctx.stroke()
    ctx.fillStyle = '#a1a1aa'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('Signez ici', 20, rect.height - 48)
    ctx.strokeStyle = '#1C1917'
    ctx.lineWidth = 2.5
    ctx.restore()
    setHasDrawn(false)
  }

  function handleValidate() {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    const base64 = canvas.toDataURL('image/png')
    onSign(base64)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-modal w-full max-w-md overflow-hidden animate-slide-up">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-base font-heading font-semibold text-surface-900">{title}</div>
              {subtitle && <div className="text-sm text-surface-500 mt-0.5 truncate">{subtitle}</div>}
            </div>
            <button onClick={onCancel} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="text-xs text-surface-400 mt-2">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' — '}
            {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="px-5 pb-3">
          <canvas
            ref={canvasRef}
            className="w-full border border-surface-200 rounded-xl cursor-crosshair touch-none"
            style={{ height: 220 }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={clear}
            disabled={isPending}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors flex-1 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Effacer
          </button>
          <button
            onClick={handleValidate}
            disabled={!hasDrawn || isPending}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors flex-1 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {validateLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
