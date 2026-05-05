'use client'

import { useState, useMemo, useRef } from 'react'
import {
  UserPlus, MoreHorizontal, Phone, Mail, Building2,
  ArrowRight, Trash2, Eye, Euro, List, LayoutGrid, Columns3,
  Search, Upload, Download, Filter, X, Star,
} from 'lucide-react'
import { Button, Badge, Modal, useToast } from '@/components/ui'
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
  prix_ht: number | null
}

interface LeadsPipelineProps {
  leads: Lead[]
  users: Pick<User, 'id' | 'first_name' | 'last_name' | 'role'>[]
  gestionnaires: Pick<User, 'id' | 'first_name' | 'last_name'>[]
  currentUserRole: string
  currentUserId: string
  formations?: Formation[]
  isApporteur?: boolean
}

const COLUMN_BG: Record<LeadStatus, string> = {
  nouveau: 'border-t-brand-400',
  contacte: 'border-t-cyan-400',
  qualification: 'border-t-warning-400',
  proposition_envoyee: 'border-t-purple-400',
  negociation: 'border-t-orange-400',
  gagne: 'border-t-success-400',
  perdu: 'border-t-danger-400',
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

type ViewMode = 'kanban' | 'list' | 'cards'
type FilterChip = 'all' | 'gagne' | 'perdu' | 'today' | 'high_score'

export function LeadsPipeline({ leads, users, gestionnaires, currentUserRole, currentUserId, formations = [], isApporteur }: LeadsPipelineProps) {
  const { toast } = useToast()
  const [view, setView] = useState<ViewMode>('kanban')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
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
    setActiveMenu(null)
  }
  async function handleConvert(leadId: string) {
    const result = await convertLeadToClientAction(leadId)
    if (result.success) toast('success', 'Lead converti en client')
    else toast('error', result.error || 'Erreur')
    setActiveMenu(null)
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
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === lead.id ? null : lead.id) }}
                className="p-1 rounded-lg text-surface-400 opacity-0 group-hover:opacity-100 hover:bg-surface-100 transition-all">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {activeMenu === lead.id && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-surface-200 shadow-elevated py-1 z-20">
                  <button onClick={() => { setDetailLead(lead); setActiveMenu(null) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50"><Eye className="h-4 w-4 text-surface-400" /> Voir le detail</button>
                  {!['gagne', 'perdu'].includes(lead.status) && (
                    <button onClick={() => handleConvert(lead.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-success-600 hover:bg-success-50"><ArrowRight className="h-4 w-4" /> Convertir en client</button>
                  )}
                  <button onClick={() => handleDelete(lead.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50"><Trash2 className="h-4 w-4" /> Supprimer</button>
                </div>
              )}
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
          <span className="text-[10px] text-surface-400">{formatDate(lead.created_at, { day: 'numeric', month: 'short' })}</span>
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
          <p className="text-surface-500 mt-1 text-sm">{leads.length} lead{leads.length > 1 ? 's' : ''} -- Valeur : {totalValue.toLocaleString('fr-FR')} EUR</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} icon={<Upload className="h-3.5 w-3.5" />}>Import</Button>
          <Button variant="secondary" size="sm" onClick={exportCSV} icon={<Download className="h-3.5 w-3.5" />}>Export</Button>
          <div className="flex bg-surface-100 rounded-lg p-0.5">
            {([
              { id: 'cards' as const, icon: <LayoutGrid className="h-4 w-4" /> },
              { id: 'kanban' as const, icon: <Columns3 className="h-4 w-4" /> },
              { id: 'list' as const, icon: <List className="h-4 w-4" /> },
            ]).map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={cn('p-2 rounded-md transition-colors', view === v.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-400 hover:text-surface-600')}>
                {v.icon}
              </button>
            ))}
          </div>
          <Button onClick={() => setCreateOpen(true)} icon={<UserPlus className="h-4 w-4" />}>Nouveau lead</Button>
        </div>
      </div>

      {/* Search + Filter chips */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input className="input-base pl-10" placeholder="Rechercher un lead..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { id: 'all' as const, label: 'Tous', count: stats.total },
            { id: 'high_score' as const, label: 'Prioritaires', count: stats.highScore },
            { id: 'gagne' as const, label: 'Gagnes', count: stats.gagnes },
            { id: 'perdu' as const, label: 'Perdus', count: stats.perdus },
            { id: 'today' as const, label: "Aujourd'hui", count: stats.today },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilterChip(f.id)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterChip === f.id ? 'bg-surface-900 text-white shadow-xs' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
              {f.label} {f.count}
            </button>
          ))}
        </div>
      </div>

      {/* ─── VUE CARTES ─── */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.sort((a, b) => calcScore(b) - calcScore(a)).map(lead => renderLeadCard(lead))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-sm text-surface-500">Aucun lead trouve</div>}
        </div>
      )}

      {/* ─── VUE KANBAN ─── */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6">
          {PIPELINE_COLUMNS.map(status => (
            <div key={status} onDragOver={handleDragOver} onDrop={e => handleDrop(e, status)}
              className={cn('flex-shrink-0 w-[280px] rounded-2xl bg-surface-50 border-t-[3px]', COLUMN_BG[status])}>
              <div className="px-3.5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-surface-700">{LEAD_STATUS_LABELS[status]}</span>
                  <span className="text-xs text-surface-400 bg-surface-200 rounded-full px-2 py-0.5">{leadsByStatus[status].length}</span>
                </div>
              </div>
              <div className="px-2.5 pb-3 space-y-2 min-h-[100px]">
                {leadsByStatus[status].map(lead => renderLeadCard(lead, true))}
                {leadsByStatus[status].length === 0 && <div className="text-center py-8 text-xs text-surface-400">Aucun lead</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── VUE LISTE ─── */}
      {view === 'list' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="table-header">Contact</th>
                  <th className="table-header">Entreprise</th>
                  <th className="table-header">Statut</th>
                  <th className="table-header">Source</th>
                  <th className="table-header text-center">Score</th>
                  <th className="table-header text-right">Montant</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filtered.map(lead => {
                  const score = calcScore(lead)
                  return (
                    <tr key={lead.id} onClick={() => setDetailLead(lead)} className="hover:bg-surface-50/50 cursor-pointer transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="text-sm font-medium text-surface-900">{lead.contact_prenom} {lead.contact_nom}</div>
                        <div className="text-xs text-surface-500">{lead.contact_email}</div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-surface-600">{lead.entreprise || '--'}</td>
                      <td className="px-6 py-3.5"><Badge variant={LEAD_STATUS_COLORS[lead.status]} dot>{LEAD_STATUS_LABELS[lead.status]}</Badge></td>
                      <td className="px-6 py-3.5 text-sm text-surface-600">{LEAD_SOURCE_LABELS[lead.source]}</td>
                      <td className="px-6 py-3.5 text-center"><span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', scoreBg(score), scoreColor(score))}>{score}</span></td>
                      <td className="px-6 py-3.5 text-sm text-right font-medium text-surface-800">{lead.montant_estime ? Number(lead.montant_estime).toLocaleString('fr-FR') + ' EUR' : '--'}</td>
                      <td className="px-6 py-3.5 text-sm text-surface-500">{formatDate(lead.created_at, { day: 'numeric', month: 'short' })}</td>
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
        <LeadForm users={users} formations={formations} isApporteur={isApporteur} hideAssign={isApporteur || users.length === 0} onSuccess={() => { setCreateOpen(false); toast('success', 'Lead créé') }} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailLead} onClose={() => setDetailLead(null)} title={detailLead ? (detailLead.contact_prenom || '') + ' ' + detailLead.contact_nom : ''} size="lg">
        {detailLead && <LeadDetail lead={detailLead} users={users} gestionnaires={gestionnaires} currentUserRole={currentUserRole} currentUserId={currentUserId} onStatusChange={s => handleStatusChange(detailLead.id, s)} onClose={() => setDetailLead(null)} />}
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
