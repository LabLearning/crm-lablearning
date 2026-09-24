'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, Users, QrCode,
  Calendar, MapPin, Video, Clock, User as UserIcon, Building2,
  List, LayoutGrid, FolderPlus, Filter, ChevronDown, Send, Play, CheckCircle2,
} from '@/components/ui/icons'
import { Button, Badge, Modal, useToast, RowMenu, PoeiBadge } from '@/components/ui'
import { SessionForm } from './SessionForm'
import { deleteSessionAction, updateSessionStatusAction } from './actions'
import {
  SESSION_STATUS_LABELS, SESSION_STATUS_COLORS,
  MODALITE_LABELS, MODALITE_COLORS,
} from '@/lib/types/formation'
import { formatDate, companyLabel } from '@/lib/utils'
import type { Session, SessionStatus, Formation, Formateur } from '@/lib/types/formation'

// Statuts absents du référentiel typé mais présents en base (colonne kanban, badges)
const STATUS_LABELS_EXTRA: Record<string, string> = { validee: 'Validée', en_attente_signatures: 'En attente de signatures' }
function statusLabel(status: string): string {
  return SESSION_STATUS_LABELS[status as SessionStatus] || STATUS_LABELS_EXTRA[status] || status
}

interface ClientLite {
  id: string
  raison_sociale: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

interface ApprenantLite {
  id: string
  prenom: string
  nom: string
  email: string | null
  client_id: string | null
}

interface SessionsListProps {
  sessions: Session[]
  formations: Pick<Formation, 'id' | 'intitule' | 'reference' | 'modalite' | 'duree_heures' | 'duree_jours'>[]
  formateurs: (Pick<Formateur, 'id' | 'prenom' | 'nom'> & { tarif_journalier?: number | null })[]
  clients?: ClientLite[]
  apprenants?: ApprenantLite[]
  periode?: 'actives' | 'passees' | 'toutes'
}

const PERIODE_LABELS: Record<string, string> = {
  actives: 'En cours & à venir',
  passees: 'Passées',
  toutes: 'Toutes',
}

// Pastille d'état du dossier : vert = pièces complètes (convention signée +
// contrat formateur), ambre = convention OK mais contrat manquant, rose =
// pas de convention signée. Le détail est dans l'infobulle.
function dotFor(s: any): string {
  if (s._dossier === 'complet') return 'bg-emerald-500'
  if (s._dossier === 'partiel') return 'bg-amber-400'
  return 'bg-rose-400'
}
function dotTitle(s: any): string {
  if (s._dossier === 'complet') return 'Dossier complet : convention signée, contrat formateur'
  return `Manque : ${(s._dossier_manque || []).join(', ')}`
}

// Créneau horaire du 1er jour (horaires_jours) ou champ horaires
function timeRange(s: any): string {
  const j = Array.isArray(s.horaires_jours) && s.horaires_jours.length ? s.horaires_jours[0] : null
  if (j) {
    const deb = j.matin_debut || j.aprem_debut
    const fin = j.aprem_fin || j.matin_fin
    if (deb && fin) return `${deb} - ${fin}`
  }
  return s.horaires || ''
}

const KANBAN_ORDER: string[] = ['planifiee', 'en_attente_signatures', 'validee', 'confirmee', 'en_cours', 'terminee', 'annulee']

// Pilule inscrits (style Dendreo : grise si 0, verte sinon)
function InscritsPill({ s }: { s: Session }) {
  const n = s._nb_inscrits ?? 0
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold shrink-0 ${n > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-400'}`}>
      <Users className="h-3 w-3 shrink-0" /> {n}{s.places_max ? `/${s.places_max}` : ''}
    </span>
  )
}

function TypePill({ s }: { s: Session }) {
  const t = (s as any).type_session
  if (!t) return null
  return (
    <span className={`px-1.5 py-0.5 rounded text-2xs font-bold shrink-0 ${t === 'intra' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'}`}>
      {t === 'intra' ? 'INTRA' : 'INTER'}
    </span>
  )
}

type SessionView = 'liste' | 'kanban'

// Switch Liste / Kanban : visible dans la barre sur écran large, dans le panneau replié sur mobile.
// Déclaré au niveau module (et non dans SessionsList) pour que React ne le remonte pas à chaque rendu.
function ViewSwitch({ view, onChange, className = '' }: { view: SessionView; onChange: (v: SessionView) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Affichage" className={`flex gap-1 bg-surface-100 rounded-xl p-1 shrink-0 ${className}`}>
      {([['liste', List, 'Liste'], ['kanban', LayoutGrid, 'Kanban']] as const).map(([v, Icon, label]) => (
        <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => onChange(v)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 md:py-1.5 rounded-lg text-[13px] md:text-xs font-medium transition-colors min-h-[36px] md:min-h-0 ${view === v ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
        </button>
      ))}
    </div>
  )
}

export function SessionsList({ sessions, formations, formateurs, clients = [], apprenants = [], periode = 'actives' }: SessionsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')

  // Période chargée côté serveur (URL ?periode=)
  function handlePeriode(p: string) {
    router.replace(p === 'actives' ? pathname : `${pathname}?periode=${p}`)
  }
  // Sessions OPCO ou parcours POEI : comme au tableau de bord, un parcours
  // n'apparaît qu'une fois (sa session chapeau), ses sessions d'intervention
  // restent dans la fiche POEI et l'espace du formateur.
  const searchParamsFamille = useSearchParams()
  const [famille, setFamille] = useState<'opco' | 'poei'>(searchParamsFamille.get('famille') === 'poei' ? 'poei' : 'opco')
  function choisirFamille(f: 'opco' | 'poei') {
    setFamille(f)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (f === 'poei') url.searchParams.set('famille', 'poei')
      else url.searchParams.delete('famille')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }
  const estParcoursPoei = (x: Session) => !!(x as any)._is_poei && (x as any)._poei_role !== 'intervention'
  const nbOpco = useMemo(() => sessions.filter((x) => !(x as any)._is_poei).length, [sessions])
  const nbPoei = useMemo(() => sessions.filter(estParcoursPoei).length, [sessions])
  const deFamille = useMemo(
    () => sessions.filter((x) => (famille === 'poei' ? estParcoursPoei(x) : !(x as any)._is_poei)),
    [sessions, famille],
  )
  /** Un parcours POEI ouvre son dossier ; une session, sa fiche. */
  const lienSession = (x: Session) => ((x as any)._poei_id ? `/dashboard/poei/${(x as any)._poei_id}` : `/dashboard/sessions/${x.id}`)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [formateurFilter, setFormateurFilter] = useState<string>('all')
  const [formationFilter, setFormationFilter] = useState<string>('all')
  const [view, setView] = useState<SessionView>('liste')
  // Sous 768 px, les tris se replient derrière un bouton « Filtres »
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [prefillFormationId, setPrefillFormationId] = useState<string | undefined>(undefined)
  const [prefillClientId, setPrefillClientId] = useState<string | undefined>(undefined)

  // Ouverture directe du formulaire préréglé depuis la fiche formation (?formation=<id>)
  // ou la fiche client (?client=<id>)
  const searchParams = useSearchParams()
  useEffect(() => {
    const fid = searchParams.get('formation')
    const cid = searchParams.get('client')
    if (fid || cid) {
      if (fid) setPrefillFormationId(fid)
      if (cid) setPrefillClientId(cid)
      setCreateOpen(true)
      // Nettoie l'URL pour éviter la réouverture au refresh
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    return deFamille.filter((s) => {
      const title = s.intitule || s.formation?.intitule || ''
      const matchSearch = title.toLowerCase().includes(search.toLowerCase()) ||
        (s.reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.lieu || '').toLowerCase().includes(search.toLowerCase()) ||
        ((s as any).client?.raison_sociale || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      const matchType = typeFilter === 'all' || (s as any).type_session === typeFilter
      const matchFormateur = formateurFilter === 'all' || (s as any).formateur_id === formateurFilter
      const matchFormation = formationFilter === 'all' || (s as any).formation_id === formationFilter
      return matchSearch && matchStatus && matchType && matchFormateur && matchFormation
    })
  }, [deFamille, search, statusFilter, typeFilter, formateurFilter, formationFilter])

  // Liste : groupée par jour de début (les plus récentes/futures en premier — même ordre que le fetch)
  const grouped = useMemo(() => {
    const byDay = new Map<string, Session[]>()
    for (const s of filtered) {
      const key = s.date_debut || 'sans-date'
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(s)
    }
    return Array.from(byDay.entries())
  }, [filtered])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: deFamille.length }
    deFamille.forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1 })
    return counts
  }, [deFamille])

  // Kanban : colonnes par statut (ordre fixe, colonnes vides masquées sauf les 4 principales)
  const kanbanCols = useMemo(() => {
    const core = ['planifiee', 'confirmee', 'en_cours', 'terminee']
    return KANBAN_ORDER.filter((st) => core.includes(st) || filtered.some((s) => s.status === st))
      .map((st) => ({ status: st, items: filtered.filter((s) => s.status === st) }))
  }, [filtered])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette session ?')) return
    const result = await deleteSessionAction(id)
    if (result.success) toast('success', 'Session supprimée')
    else toast('error', result.error || 'Erreur')
  }

  async function handleStatusChange(id: string, status: SessionStatus) {
    const result = await updateSessionStatusAction(id, status)
    if (result.success) toast('success', `Statut mis à jour : ${statusLabel(status)}`)
    else toast('error', result.error || 'Erreur')
  }

  async function handleConfirmSession(id: string) {
    const { confirmSessionAction } = await import('./confirm-actions')
    const r = await confirmSessionAction(id)
    if (r.success) toast('success', 'Session confirmée : convention et contrat envoyés pour signature')
    else toast('error', r.error || 'Erreur')
  }

  function getSessionTitle(s: Session): string {
    return s.intitule || s.formation?.intitule || 'Session sans titre'
  }

  function isToday(s: Session): boolean {
    const today = new Date().toISOString().split('T')[0]
    return s.date_debut <= today && s.date_fin >= today
  }

  function sessionMenu(s: Session) {
    return (
      <RowMenu width={208} triggerClassName="p-2.5 md:p-1.5" items={[
        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditSession(s) },
        { label: 'QR codes apprenants', icon: <QrCode className="h-4 w-4 text-surface-400" />, href: `/api/sessions/${s.id}/qr-codes`, target: '_blank' },
        { label: 'Confirmer & envoyer signatures', icon: <Send className="h-4 w-4 text-surface-400" />, onClick: () => handleConfirmSession(s.id), hidden: !(s.status === 'planifiee' && (s as any).mission_status === 'accepted') },
        { label: "Formateur doit d'abord accepter la mission", info: true, hidden: !(s.status === 'planifiee' && (s as any).mission_status !== 'accepted') },
        { label: 'En attente des signatures', info: true, infoColor: 'text-amber-600', hidden: (s.status as string) !== 'en_attente_signatures' },
        { label: 'Démarrer la session', icon: <Play className="h-4 w-4 text-surface-400" />, onClick: () => handleStatusChange(s.id, 'en_cours'), hidden: !((s.status as string) === 'validee' || s.status === 'confirmee') },
        { label: 'Terminer la session', icon: <CheckCircle2 className="h-4 w-4 text-surface-400" />, onClick: () => handleStatusChange(s.id, 'terminee'), hidden: s.status !== 'en_cours' },
        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(s.id) },
      ]} />
    )
  }

  const nbFiltresActifs = [typeFilter, formateurFilter, formationFilter, statusFilter].filter((v) => v !== 'all').length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Sessions de formation</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {famille === 'poei'
              ? `${deFamille.length} parcours POEI`
              : `${deFamille.length} session${deFamille.length > 1 ? 's' : ''}`}
            {periode !== 'toutes' && <span className="text-surface-400"> · {PERIODE_LABELS[periode].toLowerCase()}</span>}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Le circuit commercial : client -> apprenants -> formation -> session */}
          <Link href="/dashboard/dossiers/nouveau"
            className="btn-primary inline-flex items-center justify-center gap-1.5 !py-2.5 sm:!py-2 !px-4 text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0">
            <FolderPlus className="h-4 w-4" /> Nouveau dossier
          </Link>
          <Button variant="secondary" onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}
            className="w-full sm:w-auto justify-center min-h-[44px] sm:min-h-0">
            Session seule
          </Button>
        </div>
      </div>

      {/* Filtres : période (chargement serveur) puis tris combinables.
          Sous 768 px : période + recherche restent visibles, le reste se replie
          derrière un bouton « Filtres » avec compteur. */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div role="radiogroup" aria-label="Famille de sessions" className="flex gap-1 bg-surface-100 rounded-xl p-1 shrink-0 self-start w-full md:w-auto">
            {([['opco', 'Sessions OPCO', nbOpco], ['poei', 'POEI', nbPoei]] as const).map(([f, label, n]) => (
              <button key={f} type="button" role="radio" aria-checked={famille === f} onClick={() => choisirFamille(f)}
                className={`flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 md:py-1.5 rounded-lg text-[13px] md:text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] md:min-h-0 ${famille === f ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
                {label}
                <span className={`text-2xs rounded-full px-1.5 py-px tabular-nums ${famille === f ? 'bg-surface-100 text-surface-600' : 'bg-white/70 text-surface-500'}`}>{n}</span>
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Période" className="flex gap-1 bg-surface-100 rounded-xl p-1 shrink-0 self-start w-full md:w-auto">
            {(['actives', 'passees', 'toutes'] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={periode === p} onClick={() => handlePeriode(p)}
                className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[13px] md:text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] md:min-h-0 ${periode === p ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
                {PERIODE_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-1">
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 md:py-2 border border-surface-200/60 flex-1 md:max-w-md min-h-[44px] md:min-h-0">
              <Search className="h-4 w-4 text-surface-400 shrink-0" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (formation, client, formateur, lieu...)" className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1 min-w-0" />
            </div>
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}
              className={`md:hidden inline-flex items-center gap-1.5 px-3 rounded-xl border text-[13px] font-medium shrink-0 min-h-[44px] transition-colors ${filtersOpen || nbFiltresActifs > 0 ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-surface-200/80 bg-white text-surface-700'}`}>
              <Filter className="h-4 w-4" />
              Filtres
              {nbFiltresActifs > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-brand-500 text-white text-2xs font-bold">{nbFiltresActifs}</span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-surface-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {/* Switch Liste / Kanban */}
          <ViewSwitch view={view} onChange={setView} className="hidden md:flex self-start md:ml-auto" />
        </div>

        <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:items-center gap-2 md:flex-wrap rounded-xl md:rounded-none border md:border-0 border-surface-200/70 bg-white md:bg-transparent p-3 md:p-0`}>
          <div className="flex items-center justify-between gap-2 md:hidden">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Affichage</span>
            <ViewSwitch view={view} onChange={setView} />
          </div>
          {/* Type INTER / INTRA */}
          <div role="radiogroup" aria-label="Type de session" className="flex gap-1 bg-surface-100 rounded-xl p-1 shrink-0 w-full md:w-auto">
            {([['all', 'Tous types'], ['inter', 'INTER'], ['intra', 'INTRA']] as const).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={typeFilter === v} onClick={() => setTypeFilter(v)}
                className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[13px] md:text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] md:min-h-0 ${typeFilter === v ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={formationFilter} onChange={(e) => setFormationFilter(e.target.value)}
            className="w-full md:w-auto md:max-w-56 truncate text-[13px] md:text-xs font-medium rounded-xl border border-surface-200/80 bg-white px-3 py-2.5 md:py-2 text-surface-700 min-h-[44px] md:min-h-0">
            <option value="all">Toutes les formations</option>
            {formations.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
          </select>
          <select value={formateurFilter} onChange={(e) => setFormateurFilter(e.target.value)}
            className="w-full md:w-auto text-[13px] md:text-xs font-medium rounded-xl border border-surface-200/80 bg-white px-3 py-2.5 md:py-2 text-surface-700 min-h-[44px] md:min-h-0">
            <option value="all">Tous les formateurs</option>
            {formateurs.map((f) => <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto text-[13px] md:text-xs font-medium rounded-xl border border-surface-200/80 bg-white px-3 py-2.5 md:py-2 text-surface-700 min-h-[44px] md:min-h-0">
            <option value="all">Tous les statuts ({statusCounts.all || 0})</option>
            {['planifiee', 'en_attente_signatures', 'validee', 'confirmee', 'en_cours', 'terminee', 'annulee']
              .filter((st) => statusCounts[st])
              .map((st) => (
                <option key={st} value={st}>{statusLabel(st as SessionStatus)} ({statusCounts[st]})</option>
              ))}
          </select>
          <div className="flex items-center justify-between gap-3 md:contents">
            {nbFiltresActifs > 0 ? (
              <button onClick={() => { setTypeFilter('all'); setFormateurFilter('all'); setFormationFilter('all'); setStatusFilter('all') }}
                className="text-[13px] md:text-xs text-surface-500 md:text-surface-400 hover:text-surface-600 underline underline-offset-2 min-h-[36px] md:min-h-0">
                Réinitialiser
              </button>
            ) : <span className="md:hidden" />}
            <span className="text-xs text-surface-400 md:ml-auto">{filtered.length} session{filtered.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ── VUE LISTE (agenda-liste, style Dendreo) ── */}
      {view === 'liste' && (
        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <Calendar className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                <span className="text-xs font-semibold text-surface-600 capitalize">
                  {day !== 'sans-date' ? new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Sans date'}
                </span>
              </div>
              <div className="card overflow-hidden divide-y divide-surface-100">
                {items.map((s) => (
                  <div key={s.id}
                    onClick={() => window.location.href = lienSession(s)}
                    className={`hover:bg-surface-50/70 transition-colors cursor-pointer ${isToday(s) ? 'bg-brand-50/30' : ''}`}>
                    {/* ── Carte mobile (< 768 px) : tout ce qu'il faut pour reconnaître la session ── */}
                    <div className="md:hidden px-4 py-3 flex items-start gap-3">
                      <span title={dotTitle(s)} className={`h-2.5 w-2.5 mt-1.5 rounded-full shrink-0 ${dotFor(s)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-surface-900 leading-snug [overflow-wrap:anywhere]">{getSessionTitle(s)}</div>
                        {(s as any).client?.raison_sociale && (
                          <div className="flex items-center gap-1 text-[13px] font-medium text-sky-700 mt-0.5 min-w-0">
                            <Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{companyLabel((s as any).client)}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500 mt-1.5">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                            {s.date_fin !== s.date_debut
                              ? `Du ${formatDate(s.date_debut, { day: 'numeric', month: 'short' })} au ${formatDate(s.date_fin, { day: 'numeric', month: 'short' })}`
                              : formatDate(s.date_debut, { day: 'numeric', month: 'short' })}
                          </span>
                          {timeRange(s) && (
                            <span className="inline-flex items-center gap-1 font-mono"><Clock className="h-3.5 w-3.5 text-surface-400 shrink-0" />{timeRange(s)}</span>
                          )}
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <UserIcon className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                            {s.formateur
                              ? <span className="truncate">{s.formateur.prenom} {s.formateur.nom}</span>
                              : (s as any)._poei_role === 'parcours'
                                ? ((s as any)._poei_formateurs
                                  ? <span className="truncate">{(s as any)._poei_formateurs}</span>
                                  : <span className="text-amber-600">formateur à affecter</span>)
                                : <span className="text-surface-400">formateur à affecter</span>}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant={SESSION_STATUS_COLORS[s.status]} dot>{statusLabel(s.status)}</Badge>
                          <TypePill s={s} />
                          {(s as any)._is_poei && <PoeiBadge role={(s as any)._poei_role} />}
                          <InscritsPill s={s} />
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-2 -mt-1">{sessionMenu(s)}</div>
                    </div>

                    {/* ── Ligne desktop (≥ 768 px) ── */}
                    <div className="hidden md:flex items-center gap-3 px-4 py-2.5">
                    {/* Pastille couleur */}
                    <span title={dotTitle(s)} className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotFor(s)}`} />
                    {/* Horaire */}
                    <span className="text-xs font-mono text-surface-500 w-24 shrink-0">{timeRange(s)}</span>
                    {/* Titre */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-surface-900 truncate">
                        {getSessionTitle(s)}
                        {s.date_fin !== s.date_debut && (
                          <span className="text-surface-400 font-normal text-xs"> · jusqu&apos;au {formatDate(s.date_fin, { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                    </div>
                    {/* Type + POEI + statut */}
                    <TypePill s={s} />
                    {(s as any)._is_poei && <PoeiBadge role={(s as any)._poei_role} />}
                    <span className="shrink-0"><Badge variant={SESSION_STATUS_COLORS[s.status]} dot>{statusLabel(s.status)}</Badge></span>
                    {/* Inscrits */}
                    <InscritsPill s={s} />
                    {/* Formateur */}
                    <span className="hidden lg:flex items-center gap-1 text-xs text-surface-500 w-36 truncate shrink-0">
                      {s.formateur ? (
                        <><UserIcon className="h-3.5 w-3.5 text-surface-400 shrink-0" />{s.formateur.prenom} {s.formateur.nom}</>
                      ) : (s as any)._poei_role === 'parcours' ? (
                        // Un parcours n'a pas de formateur : ils sont portés par ses interventions
                        (s as any)._poei_formateurs
                          ? <><UserIcon className="h-3.5 w-3.5 text-surface-400 shrink-0" /><span className="truncate">{(s as any)._poei_formateurs}</span></>
                          : <span className="text-amber-600">à affecter</span>
                      ) : (
                        <span className="text-surface-300">à affecter</span>
                      )}
                    </span>
                    {/* Client */}
                    <span className="hidden xl:flex items-center gap-1 text-xs font-medium text-sky-700 w-40 truncate shrink-0">
                      {(s as any).client?.raison_sociale ? (<><Building2 className="h-3.5 w-3.5 shrink-0" />{companyLabel((s as any).client)}</>) : <span className="text-surface-300 font-normal">sans client</span>}
                    </span>
                    {/* Menu */}
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">{sessionMenu(s)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VUE KANBAN (monochrome, par statut) ── */}
      {view === 'kanban' && (
        <div>
          <p className="md:hidden text-2xs text-surface-400 mb-2 px-1">Faites défiler horizontalement pour voir les autres statuts.</p>
          <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 items-start -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-proximity md:snap-none">
          {kanbanCols.map((col) => (
            <div key={col.status} className="w-[82vw] max-w-[288px] md:w-72 md:max-w-none shrink-0 snap-start md:snap-align-none rounded-2xl bg-surface-50 border border-surface-200/60">
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-700">{statusLabel(col.status)}</span>
                <span className="text-2xs font-semibold text-surface-400 bg-white border border-surface-200/70 rounded-full px-2 py-0.5">{col.items.length}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 max-h-[65vh] overflow-y-auto">
                {col.items.length === 0 && (
                  <div className="text-center text-2xs text-surface-300 py-6">Aucune session</div>
                )}
                {col.items.map((s) => (
                  <div key={s.id}
                    onClick={() => window.location.href = lienSession(s)}
                    className={`bg-white rounded-xl border border-surface-200/70 p-3 hover:border-surface-300 hover:shadow-card transition-all cursor-pointer ${isToday(s) ? 'ring-1 ring-brand-300' : ''}`}>
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span title={dotTitle(s)} className={`h-2 w-2 rounded-full shrink-0 ${dotFor(s)}`} />
                        <span className="text-xs font-semibold text-surface-900 leading-snug [overflow-wrap:anywhere] line-clamp-2 md:line-clamp-1">{getSessionTitle(s)}</span>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mt-1 -mr-1">{sessionMenu(s)}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <TypePill s={s} />
                      {(s as any)._is_poei && <PoeiBadge role={(s as any)._poei_role} />}
                      <InscritsPill s={s} />
                    </div>
                    <div className="mt-2 space-y-1 text-2xs text-surface-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {formatDate(s.date_debut, { day: 'numeric', month: 'short' })}{s.date_fin !== s.date_debut ? ` → ${formatDate(s.date_fin, { day: 'numeric', month: 'short' })}` : ''}
                        {timeRange(s) && <span className="font-mono">· {timeRange(s)}</span>}
                      </div>
                      {s.formateur && <div className="flex items-center gap-1 truncate"><UserIcon className="h-3 w-3 shrink-0" />{s.formateur.prenom} {s.formateur.nom}</div>}
                      {(s as any).client?.raison_sociale && <div className="flex items-center gap-1 truncate text-sky-700"><Building2 className="h-3 w-3 shrink-0" />{companyLabel((s as any).client)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Calendar className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">
            {search || statusFilter !== 'all' || typeFilter !== 'all' || formateurFilter !== 'all' || formationFilter !== 'all' ? 'Aucune session trouvée' : 'Aucune session planifiée. Créez votre première session !'}
          </p>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setPrefillFormationId(undefined) }} title="Nouvelle session" size="lg">
        <SessionForm formations={formations} formateurs={formateurs} clients={clients} apprenants={apprenants} initialFormationId={prefillFormationId} initialClientId={prefillClientId} onSuccess={() => { setCreateOpen(false); setPrefillFormationId(undefined); setPrefillClientId(undefined); toast('success', 'Session créée') }} onCancel={() => { setCreateOpen(false); setPrefillFormationId(undefined); setPrefillClientId(undefined) }} />
      </Modal>
      <Modal isOpen={!!editSession} onClose={() => setEditSession(null)} title="Modifier la session" size="lg">
        {editSession && <SessionForm session={editSession} formations={formations} formateurs={formateurs} clients={clients} apprenants={apprenants} initialInscrits={(editSession as any)._inscrits_ids || []} onSuccess={() => { setEditSession(null); toast('success', 'Session mise à jour') }} onCancel={() => setEditSession(null)} />}
      </Modal>
    </div>
  )
}
