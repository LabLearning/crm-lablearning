'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast { id: string; type: ToastType; message: string }
interface ToastContextValue { toast: (type: ToastType, message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success-600" />,
  error: <XCircle className="h-4 w-4 text-danger-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning-600" />,
  info: <Info className="h-4 w-4 text-brand-600" />,
}

const bgStyles: Record<ToastType, string> = {
  success: 'bg-white border-surface-200',
  error: 'bg-white border-danger-200',
  warning: 'bg-white border-surface-200',
  info: 'bg-white border-surface-200',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed left-4 right-4 bottom-20 sm:left-auto sm:bottom-4 sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-elevated animate-in-up',
              bgStyles[t.type]
            )}
          >
            <span className="shrink-0">{icons[t.type]}</span>
            <p className="text-sm font-medium text-surface-800 flex-1">{t.message}</p>
            <button onClick={() => removeToast(t.id)} aria-label="Fermer" className="shrink-0 h-8 w-8 -mr-2 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
