'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  UserPlus, Phone, Mail, Building2,
  ArrowRight, Trash2, Eye, Edit3, Euro, List, LayoutGrid, Columns3,
  Search, Upload, Download, Filter, X, Star, MoreHorizontal, CalendarClock, ChevronRight,
} from '@/components/ui/icons'
import { Button, Badge, Modal, useToast, RowMenu } from '@/components/ui'
import { LeadForm } from './LeadForm'
import { LeadDetail } from './LeadDetail'
import {
  updateLeadStatusAction,
  deleteLeadAction,
  convertLeadToClientAction,
  bulkImportLeadsAction,
} from './actions'
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS,
  PIPELINE_COLUMNS,
} from '@/lib/types/crm'
import { formatDate } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/lib/types/crm'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Formation {
  id: string
  intitule: string
  tarif_inter_ht: number | null
  tarif_intra_ht: number | null
}

interface LeadsPipelineProps {
  leads: Lead[]
  users: Pick<User, 'id' | 'first_name' | 'last_name' | 'role'>[]
  gestionnaires: Pick<User, 'id' | 'first_name' | 'last_name'>[]
  currentUserRole: string
  currentUserId: string
  formations?: Formation[]
  formateurs?: { id: string; prenom: string; nom: string }[]
  franchises?: { id: string; nom: string }[]
  interactions?: any[]
  isApporteur?: boolean
}

// Score calculation (0-100)
function calcScore(lead: Lead): number {
  let s = 0
  if (lead.contact_email) s += 15
  if (lead.contact_telephone) s += 15
  if (lead.entreprise) s += 10
  if (lead.siret) s += 10
  if (lead.nombre_stagiaires && lead.nombre_stagiaires > 0) s += 5
  if (lead.montant_estime && lead.montant_estime > 0) s += 10
  if (lead.status === 'negociation') s += 15
  else if (lead.status === 'proposition_envoyee') s += 10
  else if (lead.status === 'qualification') s += 5
  // Recency
  const days = Math.round((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)
  if (days <= 2) s += 20
  else if (days <= 7) s += 10
  return Math.min(100, s)
}
function scoreColor(s: number) { return s >= 70 ? 'text-success-600' : s >= 40 ? 'text-warning-600' : 'text-danger-600' }
function scoreBg(s: number) { return s >= 70 ? 'bg-success-50' : s >= 40 ? 'bg-warning-50' : 'bg-danger-50' }

type ViewMode = 'kanban' | 'list'
type FilterChip = 'all' | 'gagne' | 'perdu' | 'today' | 'high_score'

export function LeadsPipeline({ leads, users, gestionnaires, currentUserRole, currentUserId, formations = [], formateurs = [], franchises = [], interactions = [], isApporteur }: LeadsPipelineProps) {
  const { toast } = useToast()
  const [view, setView] = useState<ViewMode>('kanban')
  // Sous 768 px la liste (cartes) est la vue par défaut : sept colonnes de
  // kanban ne tiennent pas sur un téléphone. L'utilisateur peut toujours
  // basculer vers le kanban (défilement horizontal colonne par colonne).
  const viewChosenRef = useRef(false)
  useEffect(() => {
    if (!viewChosenRef.current && window.matchMedia('(max-width: 767px)').matches) setView('list')
  }, [])
  function chooseView(v: ViewMode) { viewChosenRef.current = true; setView(v) }
  // Kanban mobile : conteneur défilant + étape visible pour la barre d'étapes
  const kanbanRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const [kanbanIndex, setKanbanIndex] = useState(0)
  const KANBAN_COL_W = 280 + 12 // largeur de colonne + gap-3
  function scrollKanbanTo(i: number) {
    kanbanRef.current?.scrollTo({ left: i * KANBAN_COL_W, behavior: 'smooth' })
  }
  // La puce de l'étape courante reste visible dans la barre d'étapes (qui
  // défile elle aussi horizontalement) : on centre la puce active.
  useEffect(() => {
    const bar = stepsRef.current
    const chip = bar?.children[kanbanIndex] as HTMLElement | undefined
    if (!bar || !chip) return
    const target = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2
    bar.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [kanbanIndex, view])
  const [createOpen, setCreateOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const autoOpenedRef = useRef<string | null>(null)

  // Ouverture auto d'un lead via ?lead=<id> (depuis une notification), UNE
  // SEULE fois : on nettoie l'URL aussitôt pour ne pas rouvrir ce lead à
  // chaque refresh (ex : après enregistrement d'un apprenant, ça renvoyait
  // l'utilisateur sur une autre fiche lead).
  useEffect(() => {
    const id = searchParams.get('lead')
    if (id && autoOpenedRef.current !== id) {
      autoOpenedRef.current = id
      const l = leads.find((x) => x.id === id)
      if (l) setDetailLead(l)
      router.replace(pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, leads])
  const [search, setSearch] = useState('')
  const [filterChip, setFilterChip] = useState<FilterChip>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Filtered leads
  const filtered = useMemo(() => {
    let f = leads.slice()
    // Search
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(l =>
        (l.contact_nom || '').toLowerCase().includes(q) ||
        (l.contact_prenom || '').toLowerCase().includes(q) ||
        (l.entreprise || '').toLowerCase().includes(q) ||
        (l.contact_email || '').toLowerCase().includes(q) ||
        (l.contact_telephone || '').includes(q) ||
        (l.tags || []).join(' ').toLowerCase().includes(q)
      )
    }
    // Status filter
    if (filterStatus !== 'all') f = f.filter(l => l.status === filterStatus)
    // Chips
    if (filterChip === 'gagne') f = f.filter(l => l.status === 'gagne')
    else if (filterChip === 'perdu') f = f.filter(l => l.status === 'perdu')
    else if (filterChip === 'today') f = f.filter(l => l.created_at.startsWith(new Date().toISOString().split('T')[0]))
    else if (filterChip === 'high_score') f = f.filter(l => calcScore(l) >= 60)
    return f
  }, [leads, search, filterStatus, filterChip])

  // Stats
  const stats = useMemo(() => ({
    total: leads.length,
    gagnes: leads.filter(l => l.status === 'gagne').length,
    perdus: leads.filter(l => l.status === 'perdu').length,
    enCours: leads.filter(l => !['gagne', 'perdu'].includes(l.status)).length,
    today: leads.filter(l => l.created_at.startsWith(new Date().toISOString().split('T')[0])).length,
    highScore: leads.filter(l => calcScore(l) >= 60).length,
  }), [leads])

  const totalValue = leads.filter(l => !['perdu'].includes(l.status)).reduce((sum, l) => sum + (l.montant_estime || 0), 0)
  const leadsByStatus = PIPELINE_COLUMNS.reduce((acc, status) => { acc[status] = filtered.filter(l => l.status === status); return acc }, {} as Record<LeadStatus, Lead[]>)

  // Actions
  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    const result = await updateLeadStatusAction(leadId, newStatus)
    if (result.success) toast('success', 'Lead deplace vers "' + LEAD_STATUS_LABELS[newStatus] + '"')
    else toast('error', result.error || 'Erreur')
  }
  async function handleDelete(leadId: string) {
    if (!confirm('Supprimer ce lead ?')) return
    const result = await deleteLeadAction(leadId)
    if (result.success) toast('success', 'Lead supprime')
    else toast('error', result.error || 'Erreur')
  }
  async function handleConvert(leadId: string) {
    const result = await convertLeadToClientAction(leadId)
    if (result.success) toast('success', 'Lead converti en client')
    else toast('error', result.error || 'Erreur')
  }

  // Drag & Drop
  function handleDragStart(e: React.DragEvent, leadId: string) { setDraggedId(leadId); e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  async function handleDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault(); if (!draggedId) return
    const lead = leads.find(l => l.id === draggedId)
    if (lead && lead.status !== status) await handleStatusChange(draggedId, status)
    setDraggedId(null)
  }

  // Export CSV
  function exportCSV() {
    const headers = ['Nom', 'Prenom', 'Email', 'Telephone', 'Entreprise', 'SIRET', 'Statut', 'Source', 'Montant', 'Score', 'Date creation']
    const rows = filtered.map(l => [
      l.contact_nom, l.contact_prenom || '', l.contact_email || '', l.contact_telephone || '',
      l.entreprise || '', l.siret || '', LEAD_STATUS_LABELS[l.status], LEAD_SOURCE_LABELS[l.source],
      l.montant_estime || '', calcScore(l), l.created_at.split('T')[0]
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads_export_' + new Date().toISOString().split('T')[0] + '.csv'; a.click()
    URL.revokeObjectURL(url)
    toast('success', filtered.length + ' lead(s) exporte(s)')
  }

  // Import CSV
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { toast('error', 'Fichier vide'); return }
      const sep = lines[0].includes(';') ? ';' : ','
      const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())
      const rows = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.replace(/"/g, '').trim())
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = cols[i] || '' })
        return obj
      }).filter(r => r.nom || r.contact_nom || r.name)
      // Map columns
      const mapped = rows.map(r => ({
        contact_nom: r.nom || r.contact_nom || r.name || r.last_name || '',
        contact_prenom: r.prenom || r.contact_prenom || r.first_name || '',
        contact_email: r.email || r.contact_email || r.mail || '',
        contact_telephone: r.telephone || r.contact_telephone || r.tel || r.phone || '',
        entreprise: r.entreprise || r.etablissement || r.raison_sociale || r.company || '',
      })).filter(r => r.contact_nom)
      setImportData(mapped)
      setShowImport(true)
    }
    reader.readAsText(file, 'UTF-8')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function doImport() {
    if (!importData.length) return
    setImporting(true)
    const result = await bulkImportLeadsAction(importData)
    setImporting(false)
    if (result.success) {
      toast('success', (result.data as any)?.imported + ' lead(s) importe(s)')
      setShowImport(false); setImportData([])
    } else toast('error', result.error || 'Erreur')
  }

  // Lead card
  function renderLeadCard(lead: Lead, compact?: boolean) {
    const score = calcScore(lead)
    return (
      <div key={lead.id} draggable onDragStart={e => handleDragStart(e, lead.id)}
        className="bg-white rounded-xl border border-surface-200/80 p-3.5 cursor-grab active:cursor-grabbing hover:shadow-card transition-all duration-150 group">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1" onClick={() => setDetailLead(lead)}>
            <div className="text-sm font-medium text-surface-900 truncate">{lead.contact_prenom} {lead.contact_nom}</div>
            {lead.entreprise && <div className="flex items-center gap-1 text-xs text-surface-500 mt-0.5"><Building2 className="h-3 w-3" /><span className="truncate">{lead.entreprise}</span></div>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', scoreBg(score), scoreColor(score))}>{score}</span>
            <div onClick={e => e.stopPropagation()}>
              <RowMenu
                width={192}
                triggerClassName="p-3 -m-2 lg:p-1.5 lg:m-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                items={[
                  { label: 'Voir le detail', icon: <Eye className="h-4 w-4 text-surface-400" />, onClick: () => setDetailLead(lead) },
                  { label: 'Modifier', icon: <Edit3 className="h-4 w-4 text-surface-400" />, onClick: () => setEditLead(lead) },
                  { label: 'Convertir en client', icon: <ArrowRight className="h-4 w-4 text-success-600" />, onClick: () => handleConvert(lead.id), hidden: ['gagne', 'perdu'].includes(lead.status) },
                  { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(lead.id), danger: true },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {lead.montant_estime && lead.montant_estime > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success-700 bg-success-50 rounded-md px-1.5 py-0.5"><Euro className="h-3 w-3" />{Number(lead.montant_estime).toLocaleString('fr-FR')}</span>
          )}
          <Badge variant="default">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
        </div>
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-100">
          <div className="flex items-center gap-1.5">
            {lead.contact_email && <Mail className="h-3.5 w-3.5 text-surface-400" />}
            {lead.contact_telephone && <Phone className="h-3.5 w-3.5 text-surface-400" />}
          </div>
          <span className="text-2xs text-surface-400">{formatDate(lead.created_at, { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Pipeline commercial</h1>
          <p className="text-surface-500 mt-1 text-sm">{leads.length} lead{leads.length > 1 ? 's' : ''} · Valeur : {totalValue.toLocaleString('fr-FR')} EUR</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        {/* Actions (tablette et plus) */}
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} icon={<Upload className="h-3.5 w-3.5" />}>Import</Button>
          <Button variant="secondary" size="sm" onClick={exportCSV} icon={<Download className="h-3.5 w-3.5" />}>Export</Button>
          <div className="flex bg-surface-100 rounded-lg p-0.5">
            {([
              { id: 'kanban' as const, icon: <Columns3 className="h-4 w-4" />, label: 'Vue kanban' },
              { id: 'list' as const, icon: <List className="h-4 w-4" />, label: 'Vue liste' },
            ]).map(v => (
              <button key={v.id} type="button" onClick={() => chooseView(v.id)}
                aria-label={v.label} title={v.label} aria-pressed={view === v.id}
                className={cn('p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/40', view === v.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-400 hover:text-surface-600')}>
                {v.icon}
              </button>
            ))}
          </div>
          <Button onClick={() => setCreateOpen(true)} icon={<UserPlus className="h-4 w-4" />}>Nouveau lead</Button>
        </div>
        {/* Actions (téléphone) : bascule de vue + menu import/export, puis bouton principal pleine largeur */}
        <div className="sm:hidden flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex bg-surface-100 rounded-lg p-0.5">
              {([
                { id: 'list' as const, icon: <List className="h-4 w-4" />, label: 'Liste' },
                { id: 'kanban' as const, icon: <Columns3 className="h-4 w-4" />, label: 'Kanban' },
              ]).map(v => (
                <button key={v.id} type="button" onClick={() => chooseView(v.id)} aria-pressed={view === v.id}
                  className={cn('h-10 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/40', view === v.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500')}>
                  {v.icon}{v.label}
                </button>
              ))}
            </div>
            <RowMenu
              width={200}
              align="right"
              trigger={<span className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-700"><MoreHorizontal className="h-4 w-4" />Plus</span>}
              triggerClassName="h-10 px-3 rounded-lg border border-surface-200 bg-white text-surface-700 hover:bg-surface-50"
              items={[
                { label: 'Importer un fichier CSV', icon: <Upload className="h-4 w-4 text-surface-400" />, onClick: () => fileRef.current?.click() },
                { label: 'Exporter la sélection (CSV)', icon: <Download className="h-4 w-4 text-surface-400" />, onClick: exportCSV },
              ]}
            />
          </div>
          <Button className="w-full justify-center min-h-[44px]" onClick={() => setCreateOpen(true)} icon={<UserPlus className="h-4 w-4" />}>Nouveau lead</Button>
        </div>
      </div>

      {/* Search + Filter chips */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input className="input-base pl-10 min-h-[44px] sm:min-h-0" placeholder="Rechercher un lead..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} aria-label="Effacer la recherche" className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-surface-400 hover:text-surface-600"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap max-md:max-md:[scrollbar-width:none] md:[scrollbar-width:thin] md:[scrollbar-width:thin] max-md:max-md:[&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-surface-300">
          {([
            { id: 'all' as const, label: 'Tous', count: stats.total },
            { id: 'high_score' as const, label: 'Prioritaires', count: stats.highScore },
            { id: 'gagne' as const, label: 'Gagnés', count: stats.gagnes },
            { id: 'perdu' as const, label: 'Perdus', count: stats.perdus },
            { id: 'today' as const, label: "Aujourd'hui", count: stats.today },
          ]).map(f => (
            <button key={f.id} type="button" onClick={() => setFilterChip(f.id)} aria-pressed={filterChip === f.id}
              className={cn('shrink-0 h-10 sm:h-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/40',
                filterChip === f.id ? 'bg-surface-900 text-white shadow-xs' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
              {f.label} {f.count}
            </button>
          ))}
        </div>
      </div>

      {/* ─── VUE KANBAN ─── */}
      {/* Sous lg : une colonne de 280 px à la fois, défilement horizontal avec
          accroche (scroll-snap) et barre d'étapes cliquable. À partir de lg :
          grille de sept colonnes inchangée. */}
      {view === 'kanban' && (
        <div>
          <div className="lg:hidden mb-3">
            <div ref={stepsRef} className="flex gap-1.5 overflow-x-auto max-md:max-md:[scrollbar-width:none] md:[scrollbar-width:thin] md:[scrollbar-width:thin] max-md:max-md:[&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-surface-300">
              {PIPELINE_COLUMNS.map((status, i) => (
                <button key={status} type="button" onClick={() => scrollKanbanTo(i)} aria-pressed={kanbanIndex === i}
                  className={cn('shrink-0 h-10 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/40',
                    kanbanIndex === i ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-600')}>
                  {LEAD_STATUS_LABELS[status]}
                  <span aria-label={`${leadsByStatus[status].length} leads`} className={cn('text-2xs rounded-full px-1.5 py-px', kanbanIndex === i ? 'bg-white/20' : 'bg-white text-surface-500')}>{leadsByStatus[status].length}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-surface-500 inline-flex items-center gap-1">
              Faites défiler vers la droite pour passer à l'étape suivante <ChevronRight className="h-3.5 w-3.5" />
            </p>
          </div>
          <div
            ref={kanbanRef}
            onScroll={e => { const el = e.currentTarget; setKanbanIndex(Math.min(PIPELINE_COLUMNS.length - 1, Math.round(el.scrollLeft / KANBAN_COL_W))) }}
            className="flex gap-3 pb-4 overflow-x-auto snap-x snap-mandatory max-md:max-md:[scrollbar-width:none] md:[scrollbar-width:thin] md:[scrollbar-width:thin] max-md:max-md:[&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-surface-300 lg:grid lg:grid-cols-7 lg:overflow-visible lg:snap-none"
          >
            {PIPELINE_COLUMNS.map(status => (
              <div key={status} onDragOver={handleDragOver} onDrop={e => handleDrop(e, status)}
                className="rounded-2xl bg-surface-50 w-[280px] shrink-0 snap-start lg:w-auto lg:shrink lg:min-w-0">
                <div className="px-3.5 py-3 flex items-center gap-2">
                  <span className="text-sm font-semibold text-surface-700 truncate">{LEAD_STATUS_LABELS[status]}</span>
                  <span className="text-xs text-surface-400 bg-surface-200 rounded-full px-2 py-0.5 shrink-0">{leadsByStatus[status].length}</span>
                </div>
                <div className="px-2.5 pb-3 space-y-2 min-h-[100px]">
                  {leadsByStatus[status].map(lead => renderLeadCard(lead, true))}
                  {leadsByStatus[status].length === 0 && <div className="text-center py-8 text-xs text-surface-400">Aucun lead</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── VUE LISTE ─── */}
      {/* Sous md : cartes (nom, entreprise, valeur, étape, prochaine action) ;
          à partir de md : le tableau d'origine. */}
      {view === 'list' && (
        <div className="md:hidden space-y-2">
          {filtered.map(lead => {
            const score = calcScore(lead)
            return (
              <div key={lead.id} className="bg-white rounded-xl border border-surface-200/80 p-4">
                <button type="button" onClick={() => setDetailLead(lead)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-surface-900 truncate">{lead.contact_prenom} {lead.contact_nom}</div>
                      {lead.entreprise && <div className="flex items-center gap-1 text-xs text-surface-500 mt-0.5"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{lead.entreprise}</span></div>}
                    </div>
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded shrink-0', scoreBg(score), scoreColor(score))}>{score}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2.5">
                    <Badge variant={LEAD_STATUS_COLORS[lead.status]} dot>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                    {lead.montant_estime && lead.montant_estime > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success-700 bg-success-50 rounded-md px-1.5 py-0.5"><Euro className="h-3 w-3" />{Number(lead.montant_estime).toLocaleString('fr-FR')}</span>
                    ) : null}
                    <span className="text-2xs text-surface-400">{formatDate(lead.created_at, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {(lead.next_action || lead.next_action_date) && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-xs text-surface-600">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 mt-px text-surface-400" />
                      <span>
                        <span className="text-surface-400">Prochaine action : </span>
                        {lead.next_action || 'à planifier'}
                        {lead.next_action_date && <span className="text-surface-400"> · {formatDate(lead.next_action_date, { day: 'numeric', month: 'short' })}</span>}
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-100">
                  <button onClick={() => setDetailLead(lead)} className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-surface-100 text-xs font-medium text-surface-700">
                    <Eye className="h-4 w-4" />Voir
                  </button>
                  <button onClick={() => setEditLead(lead)} className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-surface-100 text-xs font-medium text-surface-700">
                    <Edit3 className="h-4 w-4" />Modifier
                  </button>
                  <RowMenu
                    width={200}
                    triggerClassName="h-10 w-10 p-0 inline-flex items-center justify-center rounded-lg bg-surface-100 text-surface-600"
                    items={[
                      { label: 'Convertir en client', icon: <ArrowRight className="h-4 w-4 text-success-600" />, onClick: () => handleConvert(lead.id), hidden: ['gagne', 'perdu'].includes(lead.status) },
                      { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(lead.id), danger: true },
                    ]}
                  />
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="card text-center py-12 text-sm text-surface-500">Aucun lead</div>}
        </div>
      )}
      {view === 'list' && (
        <div className="hidden md:block card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="table-header">Contact</th>
                  <th className="table-header">Entreprise</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header">Source</th>
                  <th className="table-header text-center">Score</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filtered.map(lead => {
                  const score = calcScore(lead)
                  return (
                    <tr key={lead.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-6 py-3.5 cursor-pointer" onClick={() => setDetailLead(lead)}>
                        <div className="text-sm font-medium text-surface-900">{lead.contact_prenom} {lead.contact_nom}</div>
                        <div className="text-xs text-surface-500">{lead.contact_email}</div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-surface-600 cursor-pointer" onClick={() => setDetailLead(lead)}>{lead.entreprise || '--'}</td>
                      <td className="px-6 py-3.5 cursor-pointer" onClick={() => setDetailLead(lead)}><Badge variant={LEAD_STATUS_COLORS[lead.status]} dot>{LEAD_STATUS_LABELS[lead.status]}</Badge></td>
                      <td className="px-6 py-3.5 text-sm text-surface-600 cursor-pointer" onClick={() => setDetailLead(lead)}>{LEAD_SOURCE_LABELS[lead.source]}</td>
                      <td className="px-6 py-3.5 text-center cursor-pointer" onClick={() => setDetailLead(lead)}><span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', scoreBg(score), scoreColor(score))}>{score}</span></td>
                      <td className="px-6 py-3.5 text-sm text-surface-500 cursor-pointer" onClick={() => setDetailLead(lead)}>{formatDate(lead.created_at, { day: 'numeric', month: 'short' })}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setDetailLead(lead)} title="Voir le détail" className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditLead(lead)} title="Modifier" className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {!['gagne', 'perdu'].includes(lead.status) && (
                            <button onClick={() => handleConvert(lead.id)} title="Convertir en client" className="p-1.5 rounded-lg text-success-500 hover:bg-success-50 transition-colors">
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(lead.id)} title="Supprimer" className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-12 text-sm text-surface-500">Aucun lead</div>}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau lead" description={isApporteur ? 'Soumettez un prospect à Lab Learning' : 'Ajoutez un nouveau prospect'} size="lg">
        <LeadForm users={users} formations={formations} franchises={franchises} isApporteur={isApporteur} hideAssign={isApporteur || users.length === 0} onSuccess={() => { setCreateOpen(false); toast('success', 'Lead créé') }} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editLead} onClose={() => setEditLead(null)} title="Modifier le lead" size="lg">
        {editLead && (
          <LeadForm
            lead={editLead}
            users={users}
            formations={formations}
            franchises={franchises}
            isApporteur={isApporteur}
            hideAssign={isApporteur || users.length === 0}
            onSuccess={() => { setEditLead(null); toast('success', 'Lead mis à jour') }}
            onCancel={() => setEditLead(null)}
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailLead} onClose={() => setDetailLead(null)} title={detailLead ? (detailLead.entreprise || `${detailLead.contact_prenom || ''} ${detailLead.contact_nom}`.trim()) : ''} description={detailLead ? `${detailLead.contact_prenom || ''} ${detailLead.contact_nom}`.trim() : undefined} size="lg">
        {detailLead && <LeadDetail lead={detailLead} users={users} gestionnaires={gestionnaires} formateurs={formateurs} formations={formations} currentUserRole={currentUserRole} currentUserId={currentUserId} interactions={interactions.filter((i) => i.lead_id === detailLead.id)} onStatusChange={s => handleStatusChange(detailLead.id, s)} onClose={() => setDetailLead(null)} />}
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={showImport} onClose={() => { setShowImport(false); setImportData([]) }} title="Import CSV" size="lg">
        <div className="space-y-4">
          <div className="text-sm text-surface-600">{importData.length} lead(s) detecte(s) dans le fichier</div>
          {importData.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-surface-200">
                  <th className="text-left py-2 text-xs text-surface-500 font-medium">Nom</th>
                  <th className="text-left py-2 text-xs text-surface-500 font-medium">Prenom</th>
                  <th className="text-left py-2 text-xs text-surface-500 font-medium">Email</th>
                  <th className="text-left py-2 text-xs text-surface-500 font-medium">Telephone</th>
                  <th className="text-left py-2 text-xs text-surface-500 font-medium">Entreprise</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {importData.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-surface-800">{r.contact_nom}</td>
                      <td className="py-1.5 text-surface-600">{r.contact_prenom}</td>
                      <td className="py-1.5 text-surface-600">{r.contact_email}</td>
                      <td className="py-1.5 text-surface-600">{r.contact_telephone}</td>
                      <td className="py-1.5 text-surface-600">{r.entreprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importData.length > 20 && <div className="text-xs text-surface-400 mt-2">... et {importData.length - 20} autres</div>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowImport(false); setImportData([]) }}>Annuler</Button>
            <Button onClick={doImport} disabled={importing || !importData.length} icon={<Upload className="h-4 w-4" />}>{importing ? 'Import...' : 'Importer ' + importData.length + ' lead(s)'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
