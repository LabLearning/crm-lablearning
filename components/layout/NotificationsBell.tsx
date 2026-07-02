'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'

interface Notification {
  id: string
  titre: string
  message: string
  type: string
  lien_url: string | null
  lien_label: string | null
  entity_type?: string | null
  entity_id?: string | null
  is_read: boolean
  created_at: string
}

// Lien effectif : pour un lead, on ouvre la fiche via ?lead=<id> (robuste même si
// lien_url ne contient pas le paramètre — ex. anciennes notifications).
function resolveHref(n: { lien_url: string | null; entity_type?: string | null; entity_id?: string | null }): string | null {
  if (n.entity_type === 'lead' && n.entity_id) return `/dashboard/leads?lead=${n.entity_id}`
  return n.lien_url
}

const typeColors: Record<string, string> = {
  info: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  action: 'bg-purple-500',
  lead: 'bg-blue-500',
}

interface ToastNotif {
  id: string
  titre: string
  message: string
  type: string
  lien_url: string | null
}

export function NotificationsBell({ userId, allHref = '/dashboard/notifications' }: { userId: string; allHref?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState<ToastNotif[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data as Notification[])
        setUnreadCount(data.filter((n) => !n.is_read).length)
      }
    } catch {
      // Silently fail
    }
  }, [userId])

  // Realtime subscription
  useEffect(() => {
    fetchNotifications()

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification
          setNotifications((prev) => [n, ...prev].slice(0, 20))
          setUnreadCount((c) => c + 1)

          // Toast slide-in
          setToasts((prev) => [...prev, {
            id: n.id,
            titre: n.titre,
            message: n.message,
            type: n.type,
            lien_url: n.lien_url,
          }])

          // Auto-dismiss toast after 6s
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== n.id))
          }, 6000)

          // Petit "ding" optionnel (silencieux par défaut sans fichier audio)
          if (audioRef.current) {
            audioRef.current.play().catch(() => {})
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification
          setNotifications((prev) => prev.map((p) => (p.id === n.id ? n : p)))
          setUnreadCount((c) =>
            (payload.old as Notification)?.is_read === false && n.is_read ? Math.max(c - 1, 0) : c,
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount((c) => Math.max(c - 1, 0))
  }

  async function markAllRead() {
    const supabase = createClient()
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-xl text-surface-500 hover:bg-surface-50 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-danger-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-surface-200 shadow-modal z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
              <h3 className="text-sm font-semibold text-surface-900">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Tout lire
                  </button>
                )}
                <Link
                  href={allHref}
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-surface-500 hover:text-surface-700"
                >
                  Voir tout
                </Link>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <NotifRow key={n.id} n={n} onMarkRead={() => !n.is_read && markAsRead(n.id)} onClose={() => setIsOpen(false)} />
                ))
              ) : (
                <div className="px-4 py-8 text-center text-sm text-surface-400">Aucune notification</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toasts slide-in (incoming notifications) */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            toast={t}
            onClose={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))}
          />
        ))}
      </div>
    </>
  )
}

function NotifRow({
  n,
  onMarkRead,
  onClose,
}: {
  n: Notification
  onMarkRead: () => void
  onClose: () => void
}) {
  const content = (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className={cn('shrink-0 mt-1.5 h-2 w-2 rounded-full', !n.is_read ? (typeColors[n.type] || typeColors.info) : 'bg-transparent')} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-surface-900">{n.titre}</div>
        <div className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-surface-400">{formatDateTime(n.created_at)}</span>
          {n.lien_url && (
            <span className="text-[10px] text-brand-600 inline-flex items-center gap-0.5">
              {n.lien_label || 'Voir'} <ExternalLink className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const className = cn(
    'block border-b border-surface-100 last:border-0 cursor-pointer transition-colors',
    !n.is_read ? 'bg-brand-50/30 hover:bg-brand-50/50' : 'hover:bg-surface-50',
  )

  const href = resolveHref(n)
  if (href) {
    return (
      <Link
        href={href}
        onClick={() => { onMarkRead(); onClose() }}
        className={className}
      >
        {content}
      </Link>
    )
  }
  return (
    <div onClick={onMarkRead} className={className}>
      {content}
    </div>
  )
}

function ToastCard({ toast, onClose }: { toast: ToastNotif; onClose: () => void }) {
  const Inner = (
    <div className="bg-white border border-surface-200 shadow-modal rounded-2xl w-80 p-4 pointer-events-auto animate-slide-up">
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 h-9 w-9 rounded-xl flex items-center justify-center',
          toast.type === 'success' ? 'bg-emerald-50' :
          toast.type === 'warning' ? 'bg-amber-50' :
          toast.type === 'danger' ? 'bg-rose-50' :
          toast.type === 'action' ? 'bg-purple-50' :
          'bg-brand-50',
        )}>
          <Bell className={cn('h-4 w-4',
            toast.type === 'success' ? 'text-emerald-600' :
            toast.type === 'warning' ? 'text-amber-600' :
            toast.type === 'danger' ? 'text-rose-600' :
            toast.type === 'action' ? 'text-purple-600' :
            'text-brand-600',
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-surface-900">{toast.titre}</div>
          <div className="text-xs text-surface-600 mt-0.5 line-clamp-2">{toast.message}</div>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
          className="shrink-0 p-1 rounded-md text-surface-400 hover:bg-surface-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )

  if (toast.lien_url) {
    return <Link href={toast.lien_url} onClick={onClose}>{Inner}</Link>
  }
  return Inner
}
