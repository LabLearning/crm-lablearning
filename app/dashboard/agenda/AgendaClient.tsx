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
import { PoeiBadge } from '@/components/ui'

// Carte d'infos affichée au survol (réutilisée par la pastille et le bloc)
function SessionTooltipCard({ s, date, className }: { s: Session; date: string; className?: string }) {
  const c = creneauForDate(s, date)
  return (
    <div className={cn('pointer-events-none hidden group-hover/chip:block absolute z-[60] w-56 rounded-xl bg-white shadow-modal border border-surface-200 p-3 text-left', className)}>
      <div className="text-xs font-semibold text-surface-900 mb-1.5 leading-snug">{s.titre}</div>
      <div className="space-y-1 text-2xs text-surface-500">
        {c && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 shrink-0" />{c.debut} – {c.fin}</div>}
        <div className="flex items-center gap-1.5"><CalIcon className="h-3 w-3 shrink-0" />{frShort(s.dateDebut)}{s.dateFin !== s.dateDebut ? ` → ${frShort(s.dateFin)}` : ''}</div>
        {s.lieu && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{s.lieu}</div>}
        {s.entreprise && <div className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" />{s.entreprise}</div>}
        {s.formateurNom && <div className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" />{s.formateurNom}</div>}
      </div>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <span className={cn('inline-block px-2 py-0.5 rounded-full text-2xs font-medium', s.isPrevisionnel ? 'bg-amber-50 text-amber-700' : 'bg-surface-100 text-surface-600')}>{SESSION_STATUS_FR[s.status] || s.status}</span>
        {s.isPoei && <PoeiBadge />}
      </div>
      {s.isPrevisionnel && <div className="mt-1.5 text-2xs text-surface-400">Date non confirmée — cliquez pour ouvrir le lead</div>}
    </div>
  )
}

// Pastille compacte (vue mois)
function SessionChip({ s, date, color }: { s: Session; date: string; color?: string }) {
  const c = creneauForDate(s, date)
  return (
    <div className="relative group/chip">
      <Link href={sessionHref(s)} title={sessionTooltip(s, date)}
        className={cn('block px-1.5 py-0.5 rounded text-[9px] mb-0.5 border font-medium truncate hover:brightness-95', s.isPrevisionnel ? PREV_COLOR : (color || colorFor(s.id)))}>
        {s.isPrevisionnel && <span className="px-1 rounded bg-surface-400 text-white text-[8px] font-bold mr-0.5">PRÉV.</span>}
        {s.isPoei && <span className="px-1 rounded bg-sky-500 text-white text-[8px] font-bold mr-0.5">POEI</span>}
        {c && <span className="font-mono opacity-80">{c.debut}</span>} {s.titre}
      </Link>
      <SessionTooltipCard s={s} date={date} className="left-0 top-full mt-1" />
    </div>
  )
}

// Bloc positionné (vue semaine) : s'étend sur toute la plage horaire
function SessionBlock({ p, date }: { p: Positioned; date: string }) {
  const s = p.s
  return (
    <div className="absolute group/chip px-0.5" style={{ top: p.top, height: p.height, left: `${p.leftPct}%`, width: `${p.widthPct}%` }}>
      <Link href={sessionHref(s)} title={sessionTooltip(s, date)}
        className={cn('flex flex-col h-full rounded-md border px-1.5 py-1 overflow-hidden hover:brightness-95 transition', s.isPrevisionnel ? 'border-dashed' : '', p.color)}>
        <span className="text-[9px] font-mono leading-none opacity-80 flex items-center gap-1">
          {p.debut}–{p.fin}
          {s.isPrevisionnel && <span className="px-1 rounded bg-surface-400 text-white text-[8px] font-bold leading-tight">PRÉV.</span>}
          {s.isPoei && <span className="px-1 rounded bg-sky-500 text-white text-[8px] font-bold leading-tight">POEI</span>}
        </span>
        <span className="text-[10px] font-medium leading-tight mt-0.5 line-clamp-3">{s.titre}</span>
      </Link>
      <SessionTooltipCard s={s} date={date} className="left-full top-0 ml-1" />
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
  reference?: string; formateurNom?: string | null; horairesJours?: HoraireJour[]; isPoei?: boolean
  // Formation encore au stade lead (pas de session créée) : bloc prévisionnel
  isPrevisionnel?: boolean; leadId?: string; entreprise?: string
}

// Style des blocs prévisionnels : gris, bordure pointillée — jamais confondus
// avec une session réelle
const PREV_COLOR = 'bg-surface-50 border-dashed border-surface-400 text-surface-600'
const sessionHref = (s: Session) => s.isPrevisionnel && s.leadId ? `/dashboard/leads?lead=${s.leadId}` : `/dashboard/sessions/${s.id}`

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
const SESSION_STATUS_FR: Record<string, string> = { planifiee: 'Planifiée', confirmee: 'Confirmée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée', previsionnel: 'Prévisionnel (lead)' }
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

// ── Layout calendrier (blocs qui s'étendent sur leur plage + colonnes si chevauchement) ──
const ROW_H = 48            // hauteur d'une heure (px)
const DAY_START_H = 8       // l'agenda commence à 08:00 (voir HEURES)
function toMin(t?: string): number { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
// Palette pour différencier les sessions simultanées (ordonnée pour un contraste
// maximal entre colonnes voisines)
const AGENDA_PALETTE = [
  'bg-emerald-100 border-emerald-300 text-emerald-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-sky-100 border-sky-300 text-sky-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-brand-100 border-brand-300 text-brand-800',
]
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AGENDA_PALETTE[h % AGENDA_PALETTE.length]
}
// Couleur STABLE par session (même couleur sur toute sa durée) — coloration gloutonne :
// deux sessions dont les dates se recouvrent reçoivent des couleurs différentes.
function assignSessionColors(sessions: Session[]): Map<string, string> {
  const sorted = [...sessions].sort((a, b) => a.dateDebut.localeCompare(b.dateDebut) || a.dateFin.localeCompare(b.dateFin) || a.id.localeCompare(b.id))
  const map = new Map<string, string>()
  const assigned: { dd: string; df: string; idx: number }[] = []
  for (const s of sorted) {
    const used = new Set<number>()
    for (const a of assigned) { if (a.dd <= s.dateFin && a.df >= s.dateDebut) used.add(a.idx) }
    let idx = 0
    while (used.has(idx)) idx++
    map.set(s.id, AGENDA_PALETTE[idx % AGENDA_PALETTE.length])
    assigned.push({ dd: s.dateDebut, df: s.dateFin, idx })
  }
  return map
}
interface Positioned { s: Session; top: number; height: number; leftPct: number; widthPct: number; color: string; debut: string; fin: string }
// Positionne les sessions d'un jour : hauteur = durée, colonnes côte à côte si chevauchement
function layoutDay(sessions: Session[], date: string, colorMap: Map<string, string>): Positioned[] {
  const items = sessions
    .map((s) => { const c = creneauForDate(s, date); if (!c) return null; const startMin = toMin(c.debut); const endMin = Math.max(toMin(c.fin), startMin + 30); return { s, startMin, endMin, debut: c.debut, fin: c.fin, col: 0, ncols: 1 } })
    .filter(Boolean) as { s: Session; startMin: number; endMin: number; debut: string; fin: string; col: number; ncols: number }[]
  items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const out: Positioned[] = []
  let cluster: typeof items = []
  let clusterEnd = -1
  const flush = () => {
    const colEnds: number[] = []
    cluster.forEach((it) => {
      let placed = false
      for (let ci = 0; ci < colEnds.length; ci++) { if (colEnds[ci] <= it.startMin) { it.col = ci; colEnds[ci] = it.endMin; placed = true; break } }
      if (!placed) { it.col = colEnds.length; colEnds.push(it.endMin) }
    })
    const ncols = colEnds.length
    cluster.forEach((it) => {
      const top = Math.max(0, (it.startMin - DAY_START_H * 60) / 60 * ROW_H)
      const height = Math.max((it.endMin - it.startMin) / 60 * ROW_H - 2, 22)
      const widthPct = 100 / ncols
      // Couleur STABLE par session (identique sur toute sa durée) — gris pointillé pour le prévisionnel
      const color = it.s.isPrevisionnel ? PREV_COLOR : (colorMap.get(it.s.id) || colorFor(it.s.id))
      out.push({ s: it.s, top, height, leftPct: it.col * widthPct, widthPct, color, debut: it.debut, fin: it.fin })
    })
    cluster = []; clusterEnd = -1
  }
  items.forEach((it) => { if (cluster.length && it.startMin >= clusterEnd) flush(); cluster.push(it); clusterEnd = Math.max(clusterEnd, it.endMin) })
  if (cluster.length) flush()
  return out
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
  // Affichage des formations encore au stade lead (prévisionnel)
  const [showPrev, setShowPrev] = useState(true)
  const today = toDateStr(new Date())

  const prevCount = useMemo(() => sessions.filter(s => s.isPrevisionnel).length, [sessions])
  const visibleSessions = useMemo(
    () => (showPrev ? sessions : sessions.filter(s => !s.isPrevisionnel)),
    [sessions, showPrev],
  )

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
    return visibleSessions.filter(s => s.dateDebut <= date && s.dateFin >= date)
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
  const sessionsCount = sessions.filter(s => !s.isPrevisionnel).length
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
              <span>
                {sessionsCount} session{sessionsCount > 1 ? 's' : ''} planifiée{sessionsCount > 1 ? 's' : ''}
                {prevCount > 0 && <span className="text-surface-400"> · {prevCount} prévisionnelle{prevCount > 1 ? 's' : ''} (leads)</span>}
              </span>
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

        {tab === 'formations' && prevCount > 0 && (
          <button
            onClick={() => setShowPrev(!showPrev)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold transition-all border',
              showPrev
                ? 'bg-surface-100 text-surface-700 border-dashed border-surface-400'
                : 'bg-white text-surface-400 border-surface-200 hover:text-surface-600',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', showPrev ? 'bg-surface-500' : 'bg-surface-300')} />
            Prévisionnel ({prevCount})
          </button>
        )}

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
          sessions={visibleSessions}
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
  // Couleur stable par session (calculée une fois sur l'ensemble visible)
  const colorMap = useMemo(() => assignSessionColors(sessions), [sessions])
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
          <div className="grid grid-cols-8">
            {/* Colonne des heures */}
            <div className="relative" style={{ height: HEURES.length * ROW_H }}>
              {HEURES.map((h, i) => (
                <div key={h} className="absolute right-3 text-[11px] text-surface-400 font-mono" style={{ top: i * ROW_H - 6 }}>{h}</div>
              ))}
            </div>
            {/* Colonnes des jours */}
            {weekDates.map(d => {
              const isToday = d === today
              const positioned = layoutDay(getSessionsForDate(d), d, colorMap)
              return (
                <div key={d} className={cn('relative border-l border-surface-100', isToday && 'bg-brand-50/10')} style={{ height: HEURES.length * ROW_H }}>
                  {HEURES.map((h, i) => (
                    <div key={h} className="absolute left-0 right-0 border-b border-surface-100/70" style={{ top: i * ROW_H, height: ROW_H }} />
                  ))}
                  {positioned.map(p => <SessionBlock key={p.s.id} p={p} date={d} />)}
                </div>
              )
            })}
          </div>
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
                    <SessionChip key={s.id} s={s} date={d} color={colorMap.get(s.id)} />
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
