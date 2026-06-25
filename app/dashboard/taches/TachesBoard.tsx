'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  User,
  Users,
  CheckSquare,
  Clock,
  Eye,
  CircleCheck,
  Filter,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { moveTacheAction, assignTacheToMeAction } from './actions'
import TacheModal from './TacheModal'

type Status = 'a_faire' | 'en_cours' | 'en_revue' | 'terminee'
type Priorite = 'basse' | 'moyenne' | 'haute' | 'urgente'

interface User {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role?: string
}

interface Tache {
  id: string
  titre: string
  description: string | null
  status: Status
  priorite: Priorite
  assignee_id: string | null
  created_by: string | null
  due_date: string | null
  position: number
  labels: string[] | null
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  completed_at: string | null
  created_at: string
  assignee: User | null
  author: User | null
}

interface Props {
  taches: Tache[]
  users: User[]
  currentUserId: string
}

const COLUMNS: {
  key: Status
  label: string
  icon: any
  iconBg: string
  iconText: string
  countBg: string
  countText: string
}[] = [
  {
    key: 'a_faire',
    label: 'À faire',
    icon: CheckSquare,
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    countBg: 'bg-slate-100',
    countText: 'text-slate-600',
  },
  {
    key: 'en_cours',
    label: 'En cours',
    icon: Clock,
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    countBg: 'bg-blue-100',
    countText: 'text-blue-700',
  },
  {
    key: 'en_revue',
    label: 'En revue',
    icon: Eye,
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    countBg: 'bg-amber-100',
    countText: 'text-amber-700',
  },
  {
    key: 'terminee',
    label: 'Terminé',
    icon: CircleCheck,
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    countBg: 'bg-emerald-100',
    countText: 'text-emerald-700',
  },
]

const PRIORITE_STYLES: Record<Priorite, { dot: string; text: string; label: string }> = {
  basse: { dot: 'bg-surface-300', text: 'text-surface-500', label: 'Basse' },
  moyenne: { dot: 'bg-blue-400', text: 'text-blue-600', label: 'Moyenne' },
  haute: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Haute' },
  urgente: { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Urgente' },
}

function userInitials(u: User | null) {
  if (!u) return '?'
  const f = (u.first_name || u.email || '?').charAt(0)
  const l = (u.last_name || '').charAt(0)
  return (f + l).toUpperCase()
}

function userName(u: User | null) {
  if (!u) return '—'
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
}

function formatDue(d: string) {
  const date = new Date(d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  if (diff > 0 && diff < 7) return `Dans ${diff}j`
  if (diff < 0) return `Retard ${Math.abs(diff)}j`
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date)
}

export default function TachesBoard({ taches, users, currentUserId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  // 'all' = tout le monde · 'me' = mes tâches · 'unassigned' = non assignées · userId = un membre précis
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<Priorite | 'all'>('all')
  const [editingTache, setEditingTache] = useState<Tache | null>(null)
  const [creatingInColumn, setCreatingInColumn] = useState<Status | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [optimisticTaches, setOptimisticTaches] = useState<Tache[]>(taches)

  // Sync when server props change (after revalidate)
  useMemo(() => setOptimisticTaches(taches), [taches])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return optimisticTaches.filter((t) => {
      // Filtre assignee
      if (filterAssignee === 'me' && t.assignee_id !== currentUserId) return false
      if (filterAssignee === 'unassigned' && t.assignee_id !== null) return false
      if (
        filterAssignee !== 'all' &&
        filterAssignee !== 'me' &&
        filterAssignee !== 'unassigned' &&
        t.assignee_id !== filterAssignee
      )
        return false
      if (filterPriorite !== 'all' && t.priorite !== filterPriorite) return false
      if (q) {
        const hay = `${t.titre} ${t.description || ''} ${t.entity_label || ''} ${(t.labels || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [optimisticTaches, query, filterAssignee, filterPriorite, currentUserId])

  // Compteur de tâches actives par utilisateur (pour badge sur avatar)
  const countByUser = useMemo(() => {
    const m: Record<string, number> = { unassigned: 0 }
    optimisticTaches.forEach((t) => {
      if (t.status === 'terminee') return
      if (!t.assignee_id) m.unassigned += 1
      else m[t.assignee_id] = (m[t.assignee_id] || 0) + 1
    })
    return m
  }, [optimisticTaches])

  const byColumn = useMemo(() => {
    const m: Record<Status, Tache[]> = {
      a_faire: [],
      en_cours: [],
      en_revue: [],
      terminee: [],
    }
    filtered.forEach((t) => {
      m[t.status]?.push(t)
    })
    Object.values(m).forEach((col) => col.sort((a, b) => a.position - b.position))
    return m
  }, [filtered])

  // Stats
  const myCount = optimisticTaches.filter((t) => t.assignee_id === currentUserId && t.status !== 'terminee').length
  const overdueCount = optimisticTaches.filter(
    (t) => t.due_date && t.status !== 'terminee' && new Date(t.due_date) < new Date(new Date().toDateString()),
  ).length

  // Drag & Drop
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function onDragOverColumn(e: React.DragEvent, status: Status) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  function onDropColumn(e: React.DragEvent, status: Status) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggedId
    setDragOverColumn(null)
    setDraggedId(null)
    if (!id) return

    const target = optimisticTaches.find((t) => t.id === id)
    if (!target) return

    // Position cible : à la fin de la colonne (le drop-zone est sur la colonne entière)
    const colCount = byColumn[status].filter((t) => t.id !== id).length

    // Optimistic update
    setOptimisticTaches((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, status, position: colCount } : t))
      return updated
    })

    startTransition(async () => {
      const result = await moveTacheAction(id, status, colCount)
      if (!result.success) {
        router.refresh()
      }
    })
  }

  function onDropOnCard(e: React.DragEvent, overTache: Tache) {
    e.preventDefault()
    e.stopPropagation()
    const id = e.dataTransfer.getData('text/plain') || draggedId
    setDragOverColumn(null)
    setDraggedId(null)
    if (!id || id === overTache.id) return

    const target = optimisticTaches.find((t) => t.id === id)
    if (!target) return

    const newStatus = overTache.status
    const colTasks = byColumn[newStatus].filter((t) => t.id !== id)
    const overIdx = colTasks.findIndex((t) => t.id === overTache.id)
    const newPosition = overIdx >= 0 ? overIdx : colTasks.length

    setOptimisticTaches((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus, position: newPosition } : t)),
    )

    startTransition(async () => {
      const result = await moveTacheAction(id, newStatus, newPosition)
      if (!result.success) router.refresh()
    })
  }

  function handleAssignToMe(id: string) {
    setOptimisticTaches((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, assignee_id: currentUserId, assignee: users.find((u) => u.id === currentUserId) || null } : t,
      ),
    )
    startTransition(async () => {
      const result = await assignTacheToMeAction(id)
      if (!result.success) router.refresh()
    })
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Tâches</h1>
          <p className="text-surface-500 text-sm mt-1">
            Tableau d'équipe interne — assignez, priorisez, suivez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreatingInColumn('a_faire')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <CheckSquare className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">{optimisticTaches.length}</div>
            <div className="text-xs text-surface-500">Tâches totales</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">{myCount}</div>
            <div className="text-xs text-surface-500">Mes tâches actives</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">{overdueCount}</div>
            <div className="text-xs text-surface-500">En retard</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CircleCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-heading font-bold text-surface-900">{byColumn.terminee.length}</div>
            <div className="text-xs text-surface-500">Terminées</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 space-y-3">
        {/* Recherche + priorité */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une tâche…"
              className="input-base pl-9 w-full text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
            <select
              value={filterPriorite}
              onChange={(e) => setFilterPriorite(e.target.value as any)}
              className="input-base pl-9 pr-8 text-sm appearance-none"
            >
              <option value="all">Toutes priorités</option>
              <option value="urgente">Urgente</option>
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
              <option value="basse">Basse</option>
            </select>
          </div>
        </div>

        {/* Sélecteur d'assignee — avatars cliquables */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {/* Tous */}
          <button
            onClick={() => setFilterAssignee('all')}
            className={cn(
              'inline-flex items-center gap-1.5 shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-all',
              filterAssignee === 'all'
                ? 'bg-surface-900 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
            )}
          >
            <Users className="h-3.5 w-3.5" /> Toute l'équipe
            <span className={cn(
              'tabular-nums text-[10px] px-1 rounded',
              filterAssignee === 'all' ? 'bg-white/20' : 'bg-white text-surface-500',
            )}>
              {optimisticTaches.filter((t) => t.status !== 'terminee').length}
            </span>
          </button>

          {/* Moi */}
          <button
            onClick={() => setFilterAssignee('me')}
            className={cn(
              'inline-flex items-center gap-1.5 shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-all',
              filterAssignee === 'me'
                ? 'bg-brand-600 text-white'
                : 'bg-brand-50 text-brand-700 hover:bg-brand-100',
            )}
          >
            <User className="h-3.5 w-3.5" /> Moi
            <span className={cn(
              'tabular-nums text-[10px] px-1 rounded',
              filterAssignee === 'me' ? 'bg-white/20' : 'bg-white text-brand-700',
            )}>
              {countByUser[currentUserId] || 0}
            </span>
          </button>

          {/* Non assignées */}
          {(countByUser.unassigned || 0) > 0 && (
            <button
              onClick={() => setFilterAssignee('unassigned')}
              className={cn(
                'inline-flex items-center gap-1.5 shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-all',
                filterAssignee === 'unassigned'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
              )}
            >
              <AlertCircle className="h-3.5 w-3.5" /> Non assignées
              <span className={cn(
                'tabular-nums text-[10px] px-1 rounded',
                filterAssignee === 'unassigned' ? 'bg-white/20' : 'bg-white text-amber-700',
              )}>
                {countByUser.unassigned}
              </span>
            </button>
          )}

          {/* Séparateur visuel */}
          <div className="shrink-0 h-6 w-px bg-surface-200 mx-1" />

          {/* Un avatar par membre de l'équipe (exclu moi) */}
          {users
            .filter((u) => u.id !== currentUserId)
            .map((u) => {
              const count = countByUser[u.id] || 0
              const active = filterAssignee === u.id
              const initials = userInitials(u)
              return (
                <button
                  key={u.id}
                  onClick={() => setFilterAssignee(u.id)}
                  title={userName(u)}
                  className={cn(
                    'inline-flex items-center gap-1.5 shrink-0 h-8 pl-1 pr-3 rounded-full transition-all',
                    active
                      ? 'bg-surface-900 text-white'
                      : 'bg-surface-50 text-surface-700 border border-surface-200 hover:bg-surface-100',
                  )}
                >
                  <span className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                    active ? 'bg-white/20' : 'bg-surface-200 text-surface-700',
                  )}>
                    {initials}
                  </span>
                  <span className="text-xs font-medium max-w-[100px] truncate">
                    {u.first_name || u.email.split('@')[0]}
                  </span>
                  {count > 0 && (
                    <span className={cn(
                      'tabular-nums text-[10px] font-bold px-1 rounded',
                      active ? 'bg-white/20' : 'bg-white text-surface-600 border border-surface-200',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const Icon = col.icon
          const tasks = byColumn[col.key]
          const isOver = dragOverColumn === col.key

          return (
            <div
              key={col.key}
              onDragOver={(e) => onDragOverColumn(e, col.key)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => onDropColumn(e, col.key)}
              className={cn(
                'rounded-xl flex flex-col min-h-[200px] transition-all border',
                isOver
                  ? 'bg-white ring-2 ring-surface-300 border-transparent shadow-sm'
                  : 'bg-surface-50/70 border-surface-200/60',
              )}
            >
              {/* Column header — icône en pastille teintée, count assorti */}
              <div className="px-3 pt-3 pb-3 flex items-center justify-between group/header">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0', col.iconBg)}>
                    <Icon className={cn('h-3.5 w-3.5', col.iconText)} strokeWidth={2.2} />
                  </div>
                  <span className="text-[13px] font-semibold text-surface-900 tracking-tight">
                    {col.label}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md min-w-[20px] text-center',
                      col.countBg,
                      col.countText,
                    )}
                  >
                    {tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setCreatingInColumn(col.key)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-surface-400 hover:text-surface-700 hover:bg-white transition-all"
                  title="Ajouter une tâche"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="px-2 pb-3 space-y-2 flex-1">
                {tasks.length === 0 && (
                  <div className={cn(
                    'mx-1 h-20 rounded-lg border border-dashed flex items-center justify-center text-[11px] transition-colors',
                    isOver
                      ? 'border-surface-400 text-surface-600 bg-white'
                      : 'border-surface-200 text-surface-300',
                  )}>
                    {isOver ? 'Déposer ici' : '—'}
                  </div>
                )}
                {tasks.map((t) => {
                  const pri = PRIORITE_STYLES[t.priorite]
                  const isMine = t.assignee_id === currentUserId
                  const isOverdue =
                    t.due_date && t.status !== 'terminee' && new Date(t.due_date) < new Date(new Date().toDateString())
                  const isDragging = draggedId === t.id

                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onDragEnd={() => {
                        setDraggedId(null)
                        setDragOverColumn(null)
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDropOnCard(e, t)}
                      onClick={() => setEditingTache(t)}
                      className={cn(
                        'group bg-white border border-surface-200 rounded-lg p-3 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all',
                        isDragging && 'opacity-40',
                      )}
                    >
                      {/* Priority dot + labels */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 rounded-full', pri.dot)} />
                          <span className={cn('text-[10px] font-bold uppercase tracking-wider', pri.text)}>
                            {pri.label}
                          </span>
                        </div>
                        {t.labels && t.labels.length > 0 && (
                          <div className="flex gap-1">
                            {t.labels.slice(0, 2).map((lbl) => (
                              <span
                                key={lbl}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 truncate max-w-[80px]"
                              >
                                {lbl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div
                        className={cn(
                          'text-sm font-medium leading-snug',
                          t.status === 'terminee'
                            ? 'text-surface-400 line-through'
                            : 'text-surface-900',
                        )}
                      >
                        {t.titre}
                      </div>

                      {/* Entity link */}
                      {t.entity_label && (
                        <div className="mt-1.5 text-[11px] text-brand-600 truncate">
                          {t.entity_type === 'lead'
                            ? '↳ Lead'
                            : t.entity_type === 'dossier'
                            ? '↳ Dossier'
                            : t.entity_type === 'session'
                            ? '↳ Session'
                            : t.entity_type === 'client'
                            ? '↳ Client'
                            : t.entity_type === 'formation'
                            ? '↳ Formation'
                            : '↳'}
                          {' · '}
                          {t.entity_label}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.due_date && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                isOverdue
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-surface-100 text-surface-600',
                              )}
                            >
                              <Calendar className="h-2.5 w-2.5" />
                              {formatDue(t.due_date)}
                            </span>
                          )}
                        </div>
                        {t.assignee ? (
                          <div
                            title={userName(t.assignee)}
                            className={cn(
                              'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white',
                              isMine ? 'bg-brand-500 text-white' : 'bg-surface-200 text-surface-700',
                            )}
                          >
                            {userInitials(t.assignee)}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAssignToMe(t.id)
                            }}
                            className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                            title="M'attribuer cette tâche"
                          >
                            Me l'attribuer
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal create/edit */}
      {(editingTache || creatingInColumn) && (
        <TacheModal
          tache={editingTache}
          defaultStatus={creatingInColumn || 'a_faire'}
          users={users}
          currentUserId={currentUserId}
          onClose={() => {
            setEditingTache(null)
            setCreatingInColumn(null)
          }}
          onSaved={() => {
            setEditingTache(null)
            setCreatingInColumn(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
