'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, MoreHorizontal, Trash2, ArrowRight,
  Building2, Euro, Calendar, FolderOpen, CheckCircle2,
  Circle, AlertTriangle, Clock, ChevronRight,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { createDossierAction, updateDossierStatusAction, toggleChecklistItemAction, deleteDossierAction } from './actions'
import { DossierOpcoCard } from './DossierOpcoCard'
import { DOSSIER_STATUS_LABELS, DOSSIER_STATUS_COLORS, DOSSIER_WORKFLOW } from '@/lib/types/dossier'
import { FINANCEUR_LABELS } from '@/lib/types/crm'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { DossierFormation, DossierStatus, DossierChecklist, DossierTimeline } from '@/lib/types/dossier'
import type { Client } from '@/lib/types/crm'
import type { Formation, Session } from '@/lib/types/formation'

interface DossiersListProps {
  dossiers: DossierFormation[]
  clients: Pick<Client, 'id' | 'raison_sociale'>[]
  formations: Pick<Formation, 'id' | 'intitule' | 'reference'>[]
  sessions: Pick<Session, 'id' | 'reference' | 'date_debut'>[]
}

export function DossiersList({ dossiers, clients, formations, sessions }: DossiersListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailDossier, setDetailDossier] = useState<DossierFormation | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))
  const formationOptions = [{ value: '', label: 'Aucune' }, ...formations.map((f) => ({ value: f.id, label: f.intitule }))]
  const sessionOptions = [{ value: '', label: 'Aucune' }, ...sessions.map((s) => ({ value: s.id, label: `${s.reference || 'Session'} — ${formatDate(s.date_debut, { day: 'numeric', month: 'short' })}` }))]
  const financeurOptions = [{ value: '', label: 'Aucun' }, ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l }))]

  const filtered = useMemo(() => {
    return dossiers.filter((d) => {
      const matchSearch = d.numero.toLowerCase().includes(search.toLowerCase()) ||
        (d.client?.raison_sociale || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.formation?.intitule || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || d.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [dossiers, search, statusFilter])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createDossierAction(fd)
    if (result.success) { toast('success', 'Dossier créé'); setCreateOpen(false) }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleNextStatus(d: DossierFormation) {
    const currentIdx = DOSSIER_WORKFLOW.indexOf(d.status)
    if (currentIdx < DOSSIER_WORKFLOW.length - 1) {
      const next = DOSSIER_WORKFLOW[currentIdx + 1]
      const result = await updateDossierStatusAction(d.id, next)
      if (result.success) toast('success', `Dossier → ${DOSSIER_STATUS_LABELS[next]}`)
      else toast('error', result.error || 'Erreur')
    }
    setActiveMenu(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce dossier ?')) return
    const result = await deleteDossierAction(id)
    if (result.success) toast('success', 'Dossier supprimé')
    else toast('error', result.error || 'Erreur')
    setActiveMenu(null)
  }

  function getCompletionRate(checklist?: DossierChecklist[]): number {
    if (!checklist || checklist.length === 0) return 0
    const required = checklist.filter((c) => c.is_required)
    if (required.length === 0) return 100
    return Math.round((required.filter((c) => c.is_completed).length / required.length) * 100)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Dossiers de formation</h1>
          <p className="text-surface-500 mt-1 text-sm">{dossiers.length} dossier{dossiers.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau dossier</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', ...DOSSIER_WORKFLOW].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
              {s === 'all' ? 'Tous' : DOSSIER_STATUS_LABELS[s as DossierStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Dossiers list */}
      <div className="space-y-3">
        {filtered.map((d) => {
          const completion = getCompletionRate(d.checklist)
          const currentIdx = DOSSIER_WORKFLOW.indexOf(d.status)
          const nextStatus = currentIdx < DOSSIER_WORKFLOW.length - 1 ? DOSSIER_WORKFLOW[currentIdx + 1] : null

          return (
            <div
              key={d.id}
              className="card p-5 hover:shadow-card hover:border-brand-200 transition-all cursor-pointer"
              onClick={() => setDetailDossier(d)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-mono font-medium text-brand-600">{d.numero}</span>
                    <Badge variant={DOSSIER_STATUS_COLORS[d.status]} dot>{DOSSIER_STATUS_LABELS[d.status]}</Badge>
                    {d.financeur_type && <Badge variant="warning">{FINANCEUR_LABELS[d.financeur_type as keyof typeof FINANCEUR_LABELS]}</Badge>}
                  </div>

                  {/* Info */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500 mb-3">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{d.client?.raison_sociale || '—'}</span>
                    {d.formation && <span className="flex items-center gap-1">{d.formation.intitule}</span>}
                    {d.montant_total_ttc > 0 && (
                      <span className="flex items-center gap-1"><Euro className="h-3.5 w-3.5" />{Number(d.montant_total_ttc).toLocaleString('fr-FR')} € TTC</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Créé le {formatDate(d.date_creation, { day: 'numeric', month: 'short' })}</span>
                  </div>

                  {/* Workflow progression */}
                  <div className="flex items-center gap-0.5">
                    {DOSSIER_WORKFLOW.map((step, i) => {
                      const stepIdx = DOSSIER_WORKFLOW.indexOf(step)
                      const isCurrent = step === d.status
                      const isPast = stepIdx < currentIdx
                      return (
                        <div key={step} className="flex items-center">
                          <div className={`h-2 rounded-full transition-colors ${
                            isCurrent ? 'w-6 bg-brand-500' : isPast ? 'w-4 bg-success-400' : 'w-4 bg-surface-200'
                          }`} title={DOSSIER_STATUS_LABELS[step]} />
                          {i < DOSSIER_WORKFLOW.length - 1 && <div className="w-1" />}
                        </div>
                      )
                    })}
                    <span className="ml-2 text-2xs text-surface-400">{Math.round(((currentIdx + 1) / DOSSIER_WORKFLOW.length) * 100)}%</span>
                  </div>

                  {/* Checklist progress */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-200 max-w-32">
                      <div className={`h-full rounded-full transition-all ${completion === 100 ? 'bg-success-500' : completion > 50 ? 'bg-brand-500' : 'bg-warning-500'}`} style={{ width: `${completion}%` }} />
                    </div>
                    <span className="text-2xs text-surface-500">{completion}% complétude</span>
                    {completion < 100 && (
                      <AlertTriangle className="h-3 w-3 text-warning-500" />
                    )}
                  </div>

                  {/* Workflow OPCO (si dossier OPCO) — clic ne propage pas vers la card */}
                  {(d as any).opco_workflow_status && (d as any).opco_id && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DossierOpcoCard
                        dossierId={d.id}
                        status={(d as any).opco_workflow_status}
                        opcoNom={(d as any).opco?.nom}
                        numeroDossier={(d as any).opco_numero_dossier}
                        motifRefus={(d as any).opco_motif_refus}
                      />
                    </div>
                  )}
                </div>

                {/* Actions — stopPropagation pour ne pas déclencher le clic sur la card */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {nextStatus && (
                    <Button size="sm" onClick={() => handleNextStatus(d)} icon={<ArrowRight className="h-3.5 w-3.5" />}>
                      {DOSSIER_STATUS_LABELS[nextStatus]}
                    </Button>
                  )}
                  <ChevronRight className="h-5 w-5 text-surface-300" />
                  <div className="relative">
                    <button onClick={() => setActiveMenu(activeMenu === d.id ? null : d.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {activeMenu === d.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border shadow-elevated py-1 z-20 animate-in-scale origin-top-right">
                        <button onClick={() => handleDelete(d.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50">
                          <Trash2 className="h-4 w-4" /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <FolderOpen className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">Aucun dossier de formation</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau dossier de formation" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select id="client_id" name="client_id" label="Client *" options={clientOptions} placeholder="Sélectionner" error={errors.client_id?.[0]} />
          <Select id="formation_id" name="formation_id" label="Formation" options={formationOptions} />
          <Select id="session_id" name="session_id" label="Session" options={sessionOptions} />
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Financement</div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="financeur_type" name="financeur_type" label="Type de financeur" options={financeurOptions} />
            <Input id="financeur_nom" name="financeur_nom" label="Nom du financeur" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="numero_prise_en_charge" name="numero_prise_en_charge" label="N° prise en charge" />
            <Input id="montant_prise_en_charge" name="montant_prise_en_charge" type="number" label="Montant PEC (€)" />
          </div>
          <textarea id="notes" name="notes" rows={2} className="input-base resize-none" placeholder="Notes..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<FolderOpen className="h-4 w-4" />}>Créer le dossier</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailDossier} onClose={() => setDetailDossier(null)} title={detailDossier?.numero || ''} size="lg">
        {detailDossier && <DossierDetail dossier={detailDossier} />}
      </Modal>
    </div>
  )
}

// ---- Dossier Detail with checklist & timeline ----

function DossierDetail({ dossier }: { dossier: DossierFormation }) {
  const { toast } = useToast()

  async function handleToggleChecklist(itemId: string, current: boolean) {
    const result = await toggleChecklistItemAction(itemId, !current)
    if (!result.success) toast('error', result.error || 'Erreur')
  }

  const checklistByCategorie = (dossier.checklist || []).reduce((acc, item) => {
    const cat = item.categorie
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, DossierChecklist[]>)

  const categorieLabels: Record<string, string> = {
    administratif: 'Administratif',
    pedagogique: 'Pédagogique',
    financier: 'Financier',
  }

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto">
      {/* Checklist */}
      <div>
        <h3 className="text-sm font-semibold text-surface-800 mb-3">Checklist de complétude</h3>
        {Object.entries(checklistByCategorie).map(([cat, items]) => (
          <div key={cat} className="mb-3">
            <div className="text-2xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">{categorieLabels[cat] || cat}</div>
            <div className="space-y-1">
              {items.map((item) => (
                <label key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                  <button
                    onClick={() => handleToggleChecklist(item.id, item.is_completed)}
                    className="shrink-0"
                  >
                    {item.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-success-500" />
                    ) : (
                      <Circle className={`h-5 w-5 ${item.is_required ? 'text-surface-300' : 'text-surface-200'}`} />
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${item.is_completed ? 'text-surface-400 line-through' : 'text-surface-700'}`}>
                    {item.label}
                  </span>
                  {!item.is_required && <span className="text-2xs text-surface-400">optionnel</span>}
                  {item.is_completed && item.completed_at && (
                    <span className="text-2xs text-surface-400">{formatDate(item.completed_at, { day: 'numeric', month: 'short' })}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-surface-800 mb-3">Historique du dossier</h3>
        {(dossier.timeline || []).length > 0 ? (
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-surface-200" />
            {(dossier.timeline || []).map((event, i) => (
              <div key={event.id} className="relative pb-4 last:pb-0">
                <div className="absolute left-[-18px] top-1 w-3 h-3 rounded-full bg-brand-500 border-2 border-white" />
                <div className="text-sm text-surface-700">{event.description}</div>
                <div className="text-2xs text-surface-400 mt-0.5">
                  {event.user && `${event.user.first_name} ${event.user.last_name} · `}
                  {formatDateTime(event.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-surface-400">Aucun événement</div>
        )}
      </div>

      {/* Financement info */}
      {dossier.financeur_type && (
        <div className="p-3 rounded-xl bg-warning-50 border border-warning-200">
          <div className="text-xs font-medium text-warning-700 mb-1">Financement</div>
          <div className="text-sm text-warning-800">
            {FINANCEUR_LABELS[dossier.financeur_type as keyof typeof FINANCEUR_LABELS]} — {dossier.financeur_nom || ''}
          </div>
          {dossier.numero_prise_en_charge && (
            <div className="text-xs text-warning-600 mt-0.5">PEC n° {dossier.numero_prise_en_charge}</div>
          )}
          {dossier.montant_prise_en_charge && (
            <div className="text-xs text-warning-600">Montant : {Number(dossier.montant_prise_en_charge).toLocaleString('fr-FR')} €</div>
          )}
        </div>
      )}
    </div>
  )
}
