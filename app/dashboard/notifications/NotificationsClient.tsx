'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, ExternalLink, Trash2, Search, Filter, MailOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'

interface Notification {
  id: string
  titre: string
  message: string
  type: string
  lien_url: string | null
  lien_label: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

const TYPE_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  info: { label: 'Info', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  success: { label: 'Succès', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  warning: { label: 'Alerte', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  danger: { label: 'Critique', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  action: { label: 'Action', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  lead: { label: 'Lead', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  session: { label: 'Session', bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' },
  qcm: { label: 'QCM', bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
}

function groupByDay(notifs: Notification[]): { label: string; items: Notification[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7)

  const groups: Record<string, Notification[]> = { 'Aujourd\'hui': [], 'Hier': [], 'Cette semaine': [], 'Plus ancien': [] }
  notifs.forEach((n) => {
    const d = new Date(n.created_at)
    if (d >= today) groups["Aujourd'hui"].push(n)
    else if (d >= yesterday) groups['Hier'].push(n)
    else if (d >= weekAgo) groups['Cette semaine'].push(n)
    else groups['Plus ancien'].push(n)
  })
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

export default function NotificationsClient({ initial, userId }: { initial: Notification[]; userId: string }) {
  const [notifs, setNotifs] = useState<Notification[]>(initial)
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [query, setQuery] = useState('')

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifs-page:${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setNotifs((prev) => [payload.new as Notification, ...prev]),
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setNotifs((prev) => prev.map((n) => n.id === (payload.new as Notification).id ? payload.new as Notification : n)),
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setNotifs((prev) => prev.filter((n) => n.id !== (payload.old as Notification).id)),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifs.filter((n) => {
      if (filterRead === 'unread' && n.is_read) return false
      if (filterRead === 'read' && !n.is_read) return false
      if (filterType !== 'all' && n.type !== filterType) return false
      if (q) {
        const hay = `${n.titre} ${n.message}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [notifs, filterRead, filterType, query])

  const grouped = useMemo(() => groupByDay(filtered), [filtered])
  const unreadCount = notifs.filter((n) => !n.is_read).length
  const availableTypes = Array.from(new Set(notifs.map((n) => n.type)))

  async function markAsRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
  }

  async function markAllRead() {
    const supabase = createClient()
    const ids = notifs.filter((n) => !n.is_read).map((n) => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids)
  }

  async function deleteNotif(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
  }

  async function deleteRead() {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('user_id', userId).eq('is_read', true)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Notifications</h1>
          <p className="text-surface-500 text-sm mt-1">
            {unreadCount > 0 ? (
              <><span className="font-medium text-brand-600">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</span> · {notifs.length} au total</>
            ) : (
              <>{notifs.length} notification{notifs.length > 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50"
            >
              <MailOpen className="h-4 w-4" /> Tout marquer comme lu
            </button>
          )}
          {notifs.some((n) => n.is_read) && (
            <button
              onClick={() => { if (confirm('Supprimer toutes les notifications lues ?')) deleteRead() }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200"
            >
              <Trash2 className="h-4 w-4" /> Nettoyer les lues
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans les notifications…"
            className="input-base pl-9 w-full text-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex bg-surface-100 rounded-lg p-0.5">
            {[
              { v: 'all' as const, l: 'Toutes' },
              { v: 'unread' as const, l: 'Non lues' },
              { v: 'read' as const, l: 'Lues' },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFilterRead(opt.v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                  filterRead === opt.v ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-700',
                )}
              >
                {opt.l}
                {opt.v === 'unread' && unreadCount > 0 && (
                  <span className="ml-1 text-[10px] bg-brand-500 text-white px-1 rounded">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
          {availableTypes.length > 1 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-base pl-9 text-sm appearance-none"
              >
                <option value="all">Tous types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {grouped.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Bell className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucune notification à afficher</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2 px-1">
                {group.label}
              </div>
              <div className="card divide-y divide-surface-100">
                {group.items.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.info
                  const row = (
                    <div className={cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors group',
                      !n.is_read ? 'bg-brand-50/30' : '',
                      'hover:bg-surface-50/60',
                    )}>
                      <div className={cn('shrink-0 mt-1.5 h-2 w-2 rounded-full', !n.is_read ? meta.dot : 'bg-transparent')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', meta.bg, meta.text)}>
                            {meta.label}
                          </span>
                          <span className="text-sm font-medium text-surface-900 truncate">{n.titre}</span>
                        </div>
                        <div className="text-xs text-surface-500 mt-1 line-clamp-2">{n.message}</div>
                        <div className="text-[11px] text-surface-400 mt-1">{formatDateTime(n.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.is_read && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(n.id) }}
                            className="p-1.5 rounded-md text-surface-400 hover:text-emerald-600 hover:bg-emerald-50"
                            title="Marquer comme lu"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotif(n.id) }}
                          className="p-1.5 rounded-md text-surface-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )

                  if (n.lien_url) {
                    return (
                      <Link
                        key={n.id}
                        href={n.lien_url}
                        onClick={() => !n.is_read && markAsRead(n.id)}
                        className="block"
                      >
                        {row}
                      </Link>
                    )
                  }
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markAsRead(n.id)}
                      className="cursor-pointer"
                    >
                      {row}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
