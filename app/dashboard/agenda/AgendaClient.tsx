'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid,
  Calendar as CalIcon, Clock, MapPin, Phone, Mail,
  FileText, Bell, Clipboard, GraduationCap, CheckSquare,
  AlertCircle, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Pastille de session dans le calendrier + tooltip d'informations au survol
function SessionChip({ s, date }: { s: Session; date: string }) {
  const c = creneauForDate(s, date)
  return (
    <div className="relative group/chip">
      <Link href={`/dashboard/sessions/${s.id}`} title={sessionTooltip(s, date)}
        className="block px-1.5 py-1 rounded text-[10px] mb-0.5 bg-brand-50 text-brand-700 border border-brand-200 font-medium truncate hover:bg-brand-100">
        {c && <span className="font-mono text-brand-500">{c.debut}</span>} {s.titre}
      </Link>
      <div className="pointer-events-none hidden group-hover/chip:block absolute z-[60] left-0 top-full mt-1 w-56 rounded-xl bg-white shadow-modal border border-surface-200 p-3 text-left">
        <div className="text-xs font-semibold text-surface-900 mb-1.5 leading-snug">{s.titre}</div>
        <div className="space-y-1 text-2xs text-surface-500">
          {c && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 shrink-0" />{c.debut} – {c.fin}</div>}
          <div className="flex items-center gap-1.5"><CalIcon className="h-3 w-3 shrink-0" />{frShort(s.dateDebut)}{s.dateFin !== s.dateDebut ? ` → ${frShort(s.dateFin)}` : ''}</div>
          {s.lieu && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{s.lieu}</div>}
          {s.formateurNom && <div className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" />{s.formateurNom}</div>}
        </div>
        <div className="mt-2">
          <span className="inline-block px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-2xs font-medium">{SESSION_STATUS_FR[s.status] || s.status}</span>
        </div>
      </div>
    </div>
  )
}

interface Task {
  id: string; type: string; titre: string; date: string
  heure: string; leadName: string; leadEntreprise: string; done: boolean
}
interface HoraireJour { date: string; matin_debut?: string; matin_fin?: string; aprem_debut?: string; aprem_fin?: string }
interface Session {
  id: string; titre: string; dateDebut: string; dateFin: string
  horaires: string; lieu: string; status: string
  reference?: string; formateurNom?: string | null; horairesJours?: HoraireJour[]
}

// Créneau (début / fin) d'une session pour une date donnée, depuis horaires_jours
function creneauForDate(s: Session, date: string): { debut: string; fin: string } | null {
  const j = (s.horairesJours || []).find((x) => x.date === date)
  if (j) {
    const debut = j.matin_debut || j.aprem_debut || '09:00'
    const fin = j.aprem_fin || j.matin_fin || debut
    return { debut, fin }
  }
  // Pas de détail pour ce jour : créneau par défaut si la date est couverte
  if (s.dateDebut <= date && s.dateFin >= date) return { debut: '09:00', fin: '17:30' }
  return null
}
// Ligne d'heure (HH:00) où placer la session pour cette date
function startRowForDate(s: Session, date: string): string {
  const c = creneauForDate(s, date)
  if (!c) return ''
  const h = parseInt(c.debut.split(':')[0], 10)
  return `${String(isNaN(h) ? 9 : h).padStart(2, '0')}:00`
}
const SESSION_STATUS_FR: Record<string, string> = { planifiee: 'Planifiée', confirmee: 'Confirmée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }
function frShort(d: string): string { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) } catch { return d } }
// Texte multi-ligne du tooltip (survol) d'une session
function sessionTooltip(s: Session, date: string): string {
  const c = creneauForDate(s, date)
  const lines = [s.titre]
  if (c) lines.push(`Horaire : ${c.debut} - ${c.fin}`)
  lines.push(`Dates : ${frShort(s.dateDebut)}${s.dateFin !== s.dateDebut ? ` → ${frShort(s.dateFin)}` : ''}`)
  if (s.lieu) lines.push(`Lieu : ${s.lieu}`)
  if (s.formateurNom) lines.push(`Formateur : ${s.formateurNom}`)
  lines.push(`Statut : ${SESSION_STATUS_FR[s.status] || s.status}`)
  return lines.join('\n')
}
interface User {
  id: string; first_name: string | null; last_name: string | null; email: string
}
interface Tache {
  id: string
  titre: string
  status: 'a_faire' | 'en_cours' | 'en_revue' | 'terminee'
  priorite: 'basse' | 'moyenne' | 'haute' | 'urgente'
  dueDate: string
  assigneeId: string | null
  assigneeName: string | null
  entityType: string | null
  entityLabel: string | null
}

const TASK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  appel: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  email: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  rdv: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  relance: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  devis: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  note: { bg: 'bg-surface-50', text: 'text-surface-700', border: 'border-surface-200' },
}
const TASK_ICONS: Record<string, React.ReactNode> = {
  appel: <Phone className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  rdv: <CalIcon className="h-3 w-3" />,
  relance: <Bell className="h-3 w-3" />,
  devis: <FileText className="h-3 w-3" />,
  note: <Clipboard className="h-3 w-3" />,
}

const PRIORITE_DOT: Record<Tache['priorite'], string> = {
  basse: 'bg-slate-400',
  moyenne: 'bg-blue-500',
  haute: 'bg-amber-500',
  urgente: 'bg-rose-500',
}

const STATUS_BG: Record<Tache['status'], { bg: string; text: string; border: string; label: string }> = {
  a_faire: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: 'À faire' },
  en_cours: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'En cours' },
  en_revue: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'En revue' },
  terminee: { bg: 'bg-emerald-50/60', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Terminé' },
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const HEURES = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }
function getWeekDates(ref: Date): string[] {
  const d = new Date(ref); const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return toDateStr(dd) })
}
function getMonthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const startDay = first.getDay(); const offset = startDay === 0 ? -6 : 1 - startDay
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(year, month, 1 + offset + i); return toDateStr(d) })
}

interface AgendaClientProps {
  interactions: Task[]
  sessions: Session[]
  taches: Tache[]
  users: User[]
  currentUserId: string
}

type Tab = 'formations' | 'taches'

export function AgendaClient({ interactions, sessions, taches, users, currentUserId }: AgendaClientProps) {
  const [tab, setTab] = useState<Tab>('formations')
  const [view, setView] = useState<'semaine' | 'mois' | 'liste'>('semaine')
  const [refDate, setRefDate] = useState(new Date())
  // 'all' = tout · 'me' = moi · userId = un membre
  const [tacheFilter, setTacheFilter] = useState<string>('all')
  const today = toDateStr(new Date())

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const monthGrid = useMemo(() => getMonthGrid(refDate.getFullYear(), refDate.getMonth()), [refDate])

  function navigate(dir: number) {
    const d = new Date(refDate)
    if (view === 'semaine') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setRefDate(d)
  }

  // ────── DATA HELPERS ──────
  function getSessionsForDate(date: string) {
    return sessions.filter(s => s.dateDebut <= date && s.dateFin >= date)
  }

  const filteredTaches = useMemo(() => {
    return taches.filter(t => {
      if (tacheFilter === 'me') return t.assigneeId === currentUserId
      if (tacheFilter !== 'all') return t.assigneeId === tacheFilter
      return true
    })
  }, [taches, tacheFilter, currentUserId])

  function getTachesForDate(date: string) {
    return filteredTaches.filter(t => t.dueDate === date)
  }

  // ────── STATS HEADER ──────
  const sessionsCount = sessions.length
  const tachesActives = taches.filter(t => t.status !== 'terminee').length
  const tachesEnRetard = taches.filter(t => t.status !== 'terminee' && t.dueDate < today).length

  const periodLabel = view === 'semaine' && weekDates.length > 0
    ? <>Semaine du {new Date(weekDates[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {new Date(weekDates[6]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
    : view === 'mois'
    ? `${MOIS[refDate.getMonth()]} ${refDate.getFullYear()}`
    : 'Prochains événements'

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Agenda</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {tab === 'formations' ? (
              <span>{sessionsCount} session{sessionsCount > 1 ? 's' : ''} planifiée{sessionsCount > 1 ? 's' : ''}</span>
            ) : (
              <>
                {tachesEnRetard > 0 && <span className="text-rose-600 font-medium">{tachesEnRetard} en retard</span>}
                {tachesEnRetard > 0 && tachesActives > 0 && ' · '}
                <span>{tachesActives} active{tachesActives > 1 ? 's' : ''}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-surface-100 rounded-lg p-0.5">
            {([
              { id: 'semaine', icon: <LayoutGrid className="h-4 w-4" />, label: 'Semaine' },
              { id: 'mois', icon: <CalIcon className="h-4 w-4" />, label: 'Mois' },
              { id: 'liste', icon: <List className="h-4 w-4" />, label: 'Liste' },
            ] as const).map(v => (
              <button key={v.id} onClick={() => setView(v.id)} title={v.label}
                className={cn('p-2 rounded-md transition-colors', view === v.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-400 hover:text-surface-600')}>
                {v.icon}
              </button>
            ))}
          </div>

          {/* Nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setRefDate(new Date())} className="px-3 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors">
              Aujourd'hui
            </button>
            <button onClick={() => navigate(1)} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-surface-200">
        {([
          { id: 'formations' as Tab, label: 'Formations', icon: GraduationCap, count: sessions.length },
          { id: 'taches' as Tab, label: 'Tâches', icon: CheckSquare, count: tachesActives },
        ]).map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative -mb-px border-b-2',
                active
                  ? 'text-surface-900 border-surface-900'
                  : 'text-surface-500 border-transparent hover:text-surface-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md',
                  active ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-500',
                )}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Period label + tâches filter (only on Tâches tab) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="text-sm font-heading font-semibold text-surface-900 tracking-tight">
          {periodLabel}
        </div>

        {tab === 'taches' && users.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setTacheFilter('all')}
              className={cn(
                'shrink-0 h-7 px-2.5 rounded-full text-xs font-semibold transition-all',
                tacheFilter === 'all' ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
              )}
            >
              Tous
            </button>
            <button
              onClick={() => setTacheFilter('me')}
              className={cn(
                'shrink-0 h-7 px-2.5 rounded-full text-xs font-semibold transition-all',
                tacheFilter === 'me' ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100',
              )}
            >
              Moi
            </button>
            <div className="shrink-0 h-5 w-px bg-surface-200 mx-1" />
            {users
              .filter(u => u.id !== currentUserId)
              .slice(0, 8)
              .map(u => {
                const initials = ((u.first_name?.[0] || u.email[0]) + (u.last_name?.[0] || '')).toUpperCase()
                const active = tacheFilter === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setTacheFilter(u.id)}
                    title={[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                    className={cn(
                      'shrink-0 h-7 w-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all',
                      active
                        ? 'bg-surface-900 text-white ring-2 ring-surface-900 ring-offset-1'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
                    )}
                  >
                    {initials}
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {/* ─────────── CONTENU SELON ONGLET ─────────── */}
      {tab === 'formations' ? (
        <FormationsView
          view={view}
          weekDates={weekDates}
          monthGrid={monthGrid}
          refDate={refDate}
          today={today}
          sessions={sessions}
          getSessionsForDate={getSessionsForDate}
        />
      ) : (
        <TachesView
          view={view}
          weekDates={weekDates}
          monthGrid={monthGrid}
          refDate={refDate}
          today={today}
          taches={filteredTaches}
          getTachesForDate={getTachesForDate}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// VUE FORMATIONS
// ─────────────────────────────────────────
function FormationsView({
  view, weekDates, monthGrid, refDate, today, sessions, getSessionsForDate,
}: {
  view: 'semaine' | 'mois' | 'liste'
  weekDates: string[]
  monthGrid: string[]
  refDate: Date
  today: string
  sessions: Session[]
  getSessionsForDate: (d: string) => Session[]
}) {
  return (
    <>
      {/* SEMAINE */}
      {view === 'semaine' && (
        <div className="card overflow-visible">
          <div className="grid grid-cols-8 border-b border-surface-100">
            <div className="p-3 text-xs text-surface-400" />
            {weekDates.map((d, i) => {
              const isToday = d === today
              const date = new Date(d)
              return (
                <div key={d} className={cn('p-3 text-center border-l border-surface-100', isToday && 'bg-brand-50/30')}>
                  <div className="text-[11px] text-surface-400 font-medium">{JOURS[i]}</div>
                  <div className={cn('text-lg font-heading font-bold mt-0.5', isToday ? 'text-brand-600' : 'text-surface-800')}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
          {HEURES.map(h => (
            <div key={h} className="grid grid-cols-8 border-b border-surface-100 last:border-0 min-h-[48px]">
              <div className="p-2 text-[11px] text-surface-400 font-mono text-right pr-3 pt-1">{h}</div>
              {weekDates.map(d => {
                const sess = getSessionsForDate(d)
                const isToday = d === today
                return (
                  <div key={d} className={cn('border-l border-surface-100 p-0.5 min-h-[48px]', isToday && 'bg-brand-50/10')}>
                    {sess.filter(s => startRowForDate(s, d) === h).map(s => (
                      <SessionChip key={s.id} s={s} date={d} />
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* MOIS */}
      {view === 'mois' && (
        <div className="card overflow-visible">
          <div className="grid grid-cols-7">
            {JOURS.map(j => (
              <div key={j} className="p-2 text-center text-[11px] font-semibold text-surface-400 border-b border-surface-100">{j}</div>
            ))}
            {monthGrid.map((d, i) => {
              const date = new Date(d)
              const isCurrentMonth = date.getMonth() === refDate.getMonth()
              const isToday = d === today
              const sess = getSessionsForDate(d)
              return (
                <div key={i} className={cn(
                  'border-b border-r border-surface-100 p-1.5 min-h-[90px] transition-colors',
                  !isCurrentMonth && 'bg-surface-50/50',
                  isToday && 'bg-brand-50/20',
                )}>
                  <div className={cn(
                    'text-xs mb-1',
                    isToday ? 'font-bold text-brand-600' : isCurrentMonth ? 'text-surface-700' : 'text-surface-300',
                  )}>
                    {date.getDate()}
                  </div>
                  {sess.slice(0, 3).map(s => (
                    <SessionChip key={s.id} s={s} date={d} />
                  ))}
                  {sess.length > 3 && <div className="text-[9px] text-surface-400 px-1">+{sess.length - 3}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LISTE */}
      {view === 'liste' && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
              <GraduationCap className="h-6 w-6 text-surface-400 mb-3" />
              <p className="text-sm text-surface-500">Aucune session planifiée</p>
            </div>
          ) : (
            sessions
              .slice()
              .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
              .map(s => (
                <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-surface-200/80 bg-white hover:border-brand-300 transition-colors">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-50">
                    <GraduationCap className="h-5 w-5 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{s.titre}</div>
                    <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-3">
                      {s.horaires && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horaires}</span>}
                      {s.lieu && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.lieu}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-surface-700">
                      {new Date(s.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {s.dateFin !== s.dateDebut && (
                        <> → {new Date(s.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>
                      )}
                    </div>
                    <div className="text-[11px] text-surface-400 capitalize">{s.status}</div>
                  </div>
                </Link>
              ))
          )}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────
// VUE TÂCHES
// ─────────────────────────────────────────
function TacheChip({ t }: { t: Tache }) {
  const st = STATUS_BG[t.status]
  return (
    <Link href="/dashboard/taches"
      className={cn(
        'block px-1.5 py-1 rounded text-[10px] mb-0.5 border truncate hover:opacity-80 transition-opacity',
        st.bg, st.text, st.border,
      )}
    >
      <div className="flex items-center gap-1 font-medium">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', PRIORITE_DOT[t.priorite])} />
        <span className="truncate">{t.titre}</span>
      </div>
    </Link>
  )
}

function TachesView({
  view, weekDates, monthGrid, refDate, today, taches, getTachesForDate,
}: {
  view: 'semaine' | 'mois' | 'liste'
  weekDates: string[]
  monthGrid: string[]
  refDate: Date
  today: string
  taches: Tache[]
  getTachesForDate: (d: string) => Tache[]
}) {
  const overdue = taches.filter(t => t.status !== 'terminee' && t.dueDate < today)
  const todayList = taches.filter(t => t.dueDate === today)
  const upcoming = taches.filter(t => t.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <>
      {/* SEMAINE — vue par jour, tâches positionnées sur leur due_date */}
      {view === 'semaine' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-surface-100">
            {weekDates.map((d, i) => {
              const isToday = d === today
              const date = new Date(d)
              return (
                <div key={d} className={cn('p-3 text-center border-l first:border-l-0 border-surface-100', isToday && 'bg-brand-50/30')}>
                  <div className="text-[11px] text-surface-400 font-medium">{JOURS[i]}</div>
                  <div className={cn('text-lg font-heading font-bold mt-0.5', isToday ? 'text-brand-600' : 'text-surface-800')}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 min-h-[420px]">
            {weekDates.map(d => {
              const dayTaches = getTachesForDate(d)
              const isToday = d === today
              return (
                <div key={d} className={cn('border-l first:border-l-0 border-surface-100 p-2 space-y-1', isToday && 'bg-brand-50/10')}>
                  {dayTaches.length === 0 ? (
                    <div className="text-[10px] text-surface-300 text-center py-4">—</div>
                  ) : (
                    dayTaches.map(t => <TacheChip key={t.id} t={t} />)
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MOIS */}
      {view === 'mois' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7">
            {JOURS.map(j => (
              <div key={j} className="p-2 text-center text-[11px] font-semibold text-surface-400 border-b border-surface-100">{j}</div>
            ))}
            {monthGrid.map((d, i) => {
              const date = new Date(d)
              const isCurrentMonth = date.getMonth() === refDate.getMonth()
              const isToday = d === today
              const dayTaches = getTachesForDate(d)
              return (
                <div key={i} className={cn(
                  'border-b border-r border-surface-100 p-1.5 min-h-[110px] transition-colors',
                  !isCurrentMonth && 'bg-surface-50/50',
                  isToday && 'bg-brand-50/20',
                )}>
                  <div className={cn(
                    'text-xs mb-1',
                    isToday ? 'font-bold text-brand-600' : isCurrentMonth ? 'text-surface-700' : 'text-surface-300',
                  )}>
                    {date.getDate()}
                  </div>
                  {dayTaches.slice(0, 4).map(t => <TacheChip key={t.id} t={t} />)}
                  {dayTaches.length > 4 && <div className="text-[9px] text-surface-400 px-1">+{dayTaches.length - 4}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LISTE */}
      {view === 'liste' && (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-rose-600 mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> En retard ({overdue.length})
              </div>
              <div className="space-y-1.5">
                {overdue.map(t => <TacheRow key={t.id} t={t} overdue />)}
              </div>
            </div>
          )}
          {todayList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-brand-600 mb-2">Aujourd'hui ({todayList.length})</div>
              <div className="space-y-1.5">
                {todayList.map(t => <TacheRow key={t.id} t={t} />)}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-surface-500 mb-2">À venir</div>
            {upcoming.length === 0 ? (
              <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
                <CheckSquare className="h-6 w-6 text-surface-400 mb-3" />
                <p className="text-sm text-surface-500">Aucune tâche planifiée à venir</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map(t => <TacheRow key={t.id} t={t} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function TacheRow({ t, overdue }: { t: Tache; overdue?: boolean }) {
  const st = STATUS_BG[t.status]
  return (
    <Link href="/dashboard/taches"
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border bg-white hover:border-surface-300 transition-colors',
        overdue ? 'border-rose-200 bg-rose-50/30' : 'border-surface-200/80',
      )}
    >
      <div className={cn('h-2 w-2 rounded-full shrink-0', PRIORITE_DOT[t.priorite])} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-surface-900 truncate">{t.titre}</div>
        <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border', st.bg, st.text, st.border)}>
            {st.label}
          </span>
          {t.assigneeName && (
            <span className="text-surface-500">· {t.assigneeName}</span>
          )}
          {t.entityLabel && (
            <span className="text-brand-600 truncate">· {t.entityLabel}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn('text-xs font-medium', overdue ? 'text-rose-600' : 'text-surface-700')}>
          {new Date(t.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    </Link>
  )
}
