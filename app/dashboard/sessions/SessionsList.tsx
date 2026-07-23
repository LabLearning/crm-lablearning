'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, Users, QrCode,
  Calendar, MapPin, Video, Clock, User as UserIcon, Building2,
  List, LayoutGrid,
} from 'lucide-react'
import { Button, Badge, Modal, useToast, RowMenu, PoeiBadge } from '@/components/ui'
import { SessionForm } from './SessionForm'
import { deleteSessionAction, updateSessionStatusAction } from './actions'
import {
  SESSION_STATUS_LABELS, SESSION_STATUS_COLORS,
  MODALITE_LABELS, MODALITE_COLORS,
} from '@/lib/types/formation'
import { formatDate } from '@/lib/utils'
import type { Session, SessionStatus, Formation, Formateur } from '@/lib/types/formation'

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

// Pastille de couleur stable par session (repère visuel, style Dendreo)
const DOT_PALETTE = ['bg-emerald-400', 'bg-purple-400', 'bg-amber-400', 'bg-sky-400', 'bg-rose-400', 'bg-teal-400', 'bg-indigo-400']
function dotFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return DOT_PALETTE[h % DOT_PALETTE.length]
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

export function SessionsList({ sessions, formations, formateurs, clients = [], apprenants = [], periode = 'actives' }: SessionsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')

  // Période chargée côté serveur (URL ?periode=)
  function handlePeriode(p: string) {
    router.replace(p === 'actives' ? pathname : `${pathname}?periode=${p}`)
  }
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [view, setView] = useState<'liste' | 'kanban'>('liste')
  const [createOpen, setCreateOpen] = useState(false)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [prefillFormationId, setPrefillFormationId] = useState<string | undefined>(undefined)

  // Ouverture directe du formulaire préréglé depuis la fiche formation (?formation=<id>)
  const searchParams = useSearchParams()
  useEffect(() => {
    const fid = searchParams.get('formation')
    if (fid) {
      setPrefillFormationId(fid)
      setCreateOpen(true)
      // Nettoie l'URL pour éviter la réouverture au refresh
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const title = s.intitule || s.formation?.intitule || ''
      const matchSearch = title.toLowerCase().includes(search.toLowerCase()) ||
        (s.reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.lieu || '').toLowerCase().includes(search.toLowerCase()) ||
        ((s as any).client?.raison_sociale || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [sessions, search, statusFilter])

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
    const counts: Record<string, number> = { all: sessions.length }
    sessions.forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1 })
    return counts
  }, [sessions])

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
    if (result.success) toast('success', `Statut mis à jour : ${SESSION_STATUS_LABELS[status]}`)
    else toast('error', result.error || 'Erreur')
  }

  async function handleConfirmSession(id: string) {
    const { confirmSessionAction } = await import('./confirm-actions')
    const r = await confirmSessionAction(id)
    if (r.success) toast('success', 'Session confirmée — convention et contrat envoyés pour signature')
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
      <RowMenu width={208} items={[
        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditSession(s) },
        { label: 'QR codes apprenants', icon: <QrCode className="h-4 w-4 text-surface-400" />, href: `/api/sessions/${s.id}/qr-codes`, target: '_blank' },
        { label: 'Confirmer & envoyer signatures', onClick: () => handleConfirmSession(s.id), hidden: !(s.status === 'planifiee' && (s as any).mission_status === 'accepted') },
        { label: "Formateur doit d'abord accepter la mission", info: true, hidden: !(s.status === 'planifiee' && (s as any).mission_status !== 'accepted') },
        { label: 'En attente des signatures', info: true, infoColor: 'text-amber-600', hidden: s.status !== 'en_attente_signatures' },
        { label: 'Démarrer la session', onClick: () => handleStatusChange(s.id, 'en_cours'), hidden: !(s.status === 'validee' || s.status === 'confirmee') },
        { label: 'Terminer la session', onClick: () => handleStatusChange(s.id, 'terminee'), hidden: s.status !== 'en_cours' },
        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(s.id) },
      ]} />
    )
  }

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
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${t === 'intra' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'}`}>
        {t === 'intra' ? 'INTRA' : 'INTER'}
      </span>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Sessions de formation</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {sessions.length} session{sessions.length > 1 ? 's' : ''}
            {periode !== 'toutes' && <span className="text-surface-400"> · {PERIODE_LABELS[periode].toLowerCase()}</span>}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
          Nouvelle session
        </Button>
      </div>

      {/* Filtres + switch de vue */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Période (chargement serveur : les sessions passées ne sont pas chargées par défaut) */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 shrink-0 self-start">
          {(['actives', 'passees', 'toutes'] as const).map((p) => (
            <button key={p} onClick={() => handlePeriode(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${periode === p ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
              {PERIODE_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400 shrink-0" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (formation, client, formateur, lieu...)" className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', 'planifiee', 'confirmee', 'en_cours', 'terminee', 'annulee'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
              {s === 'all' ? 'Toutes' : SESSION_STATUS_LABELS[s as SessionStatus]}
              <span className="ml-1 opacity-60">({statusCounts[s] || 0})</span>
            </button>
          ))}
        </div>
        {/* Switch Liste / Kanban */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 shrink-0 self-start">
          {([['liste', List, 'Liste'], ['kanban', LayoutGrid, 'Kanban']] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
            </button>
          ))}
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
                    onClick={() => window.location.href = `/dashboard/sessions/${s.id}`}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50/70 transition-colors cursor-pointer ${isToday(s) ? 'bg-brand-50/30' : ''}`}>
                    {/* Pastille couleur */}
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotFor(s.id)}`} />
                    {/* Horaire */}
                    <span className="text-xs font-mono text-surface-500 w-24 shrink-0">{timeRange(s) || '—'}</span>
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
                    <span className="hidden sm:block shrink-0"><Badge variant={SESSION_STATUS_COLORS[s.status]} dot>{SESSION_STATUS_LABELS[s.status]}</Badge></span>
                    {/* Inscrits */}
                    <InscritsPill s={s} />
                    {/* Formateur */}
                    <span className="hidden lg:flex items-center gap-1 text-xs text-surface-500 w-36 truncate shrink-0">
                      {s.formateur ? (
                        <><UserIcon className="h-3.5 w-3.5 text-surface-400 shrink-0" />{s.formateur.prenom} {s.formateur.nom}</>
                      ) : (s as any)._poei_role === 'parcours' ? (
                        // Un parcours n'a pas de formateur : ils sont affectés par intervention
                        <span className="text-surface-300">par intervention</span>
                      ) : (
                        <span className="text-surface-300">— formateur</span>
                      )}
                    </span>
                    {/* Client */}
                    <span className="hidden xl:flex items-center gap-1 text-xs font-medium text-sky-700 w-40 truncate shrink-0">
                      {(s as any).client?.raison_sociale ? (<><Building2 className="h-3.5 w-3.5 shrink-0" />{(s as any).client.raison_sociale}</>) : <span className="text-surface-300 font-normal">—</span>}
                    </span>
                    {/* Menu */}
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">{sessionMenu(s)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VUE KANBAN (monochrome, par statut) ── */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {kanbanCols.map((col) => (
            <div key={col.status} className="w-72 shrink-0 rounded-2xl bg-surface-50 border border-surface-200/60">
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-700">{SESSION_STATUS_LABELS[col.status as SessionStatus] || col.status}</span>
                <span className="text-2xs font-semibold text-surface-400 bg-white border border-surface-200/70 rounded-full px-2 py-0.5">{col.items.length}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 max-h-[65vh] overflow-y-auto">
                {col.items.length === 0 && (
                  <div className="text-center text-2xs text-surface-300 py-6">Aucune session</div>
                )}
                {col.items.map((s) => (
                  <div key={s.id}
                    onClick={() => window.location.href = `/dashboard/sessions/${s.id}`}
                    className={`bg-white rounded-xl border border-surface-200/70 p-3 hover:border-surface-300 hover:shadow-card transition-all cursor-pointer ${isToday(s) ? 'ring-1 ring-brand-300' : ''}`}>
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotFor(s.id)}`} />
                        <span className="text-xs font-semibold text-surface-900 truncate leading-snug">{getSessionTitle(s)}</span>
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
                      {(s as any).client?.raison_sociale && <div className="flex items-center gap-1 truncate text-sky-700"><Building2 className="h-3 w-3 shrink-0" />{(s as any).client.raison_sociale}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Calendar className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">
            {search || statusFilter !== 'all' ? 'Aucune session trouvée' : 'Aucune session planifiée. Créez votre première session !'}
          </p>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setPrefillFormationId(undefined) }} title="Nouvelle session" size="lg">
        <SessionForm formations={formations} formateurs={formateurs} clients={clients} apprenants={apprenants} initialFormationId={prefillFormationId} onSuccess={() => { setCreateOpen(false); setPrefillFormationId(undefined); toast('success', 'Session créée') }} onCancel={() => { setCreateOpen(false); setPrefillFormationId(undefined) }} />
      </Modal>
      <Modal isOpen={!!editSession} onClose={() => setEditSession(null)} title="Modifier la session" size="lg">
        {editSession && <SessionForm session={editSession} formations={formations} formateurs={formateurs} clients={clients} apprenants={apprenants} initialInscrits={(editSession as any)._inscrits_ids || []} onSuccess={() => { setEditSession(null); toast('success', 'Session mise à jour') }} onCancel={() => setEditSession(null)} />}
      </Modal>
    </div>
  )
}
