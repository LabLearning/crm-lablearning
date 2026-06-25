'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Trash2, ArrowRight, Save,
  MessageSquareWarning, AlertTriangle, Clock, CheckCircle2,
  Lightbulb, Eye,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import {
  createReclamationAction, updateReclamationStatusAction,
  createActionAction, updateActionStatusAction, deleteReclamationAction,
} from './actions'
import {
  RECLAMATION_STATUS_LABELS, RECLAMATION_STATUS_COLORS, ORIGINE_LABELS,
  PRIORITE_LABELS, PRIORITE_COLORS, ACTION_STATUS_LABELS, ACTION_STATUS_COLORS,
} from '@/lib/types/qualiopi'
import { formatDate } from '@/lib/utils'
import type { Reclamation, ReclamationStatus, ActionAmelioration, ActionStatus, ReclamationOrigine, ActionPriorite } from '@/lib/types/qualiopi'
import type { User } from '@/lib/types'

interface ReclamationsListProps {
  reclamations: Reclamation[]
  actions: ActionAmelioration[]
  users: Pick<User, 'id' | 'first_name' | 'last_name'>[]
}

const origineOptions = Object.entries(ORIGINE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const prioriteOptions = Object.entries(PRIORITE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const sourceOptions = [
  { value: 'reclamation', label: 'Réclamation' },
  { value: 'evaluation', label: 'Évaluation' },
  { value: 'audit', label: 'Audit' },
  { value: 'veille', label: 'Veille' },
  { value: 'interne', label: 'Interne' },
]

export function ReclamationsList({ reclamations, actions, users }: ReclamationsListProps) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'reclamations' | 'actions'>('reclamations')
  const [search, setSearch] = useState('')
  const [createRecOpen, setCreateRecOpen] = useState(false)
  const [createActionOpen, setCreateActionOpen] = useState(false)
  const [detailRec, setDetailRec] = useState<Reclamation | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const userOptions = [{ value: '', label: 'Non assigné' }, ...users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))]

  // KPIs
  const kpis = useMemo(() => {
    const open = reclamations.filter((r) => r.status !== 'cloturee')
    const closed = reclamations.filter((r) => r.status === 'cloturee')
    const avgDays = closed.length > 0
      ? closed.reduce((s, r) => {
          const start = new Date(r.date_reception).getTime()
          const end = new Date(r.date_cloture || r.updated_at).getTime()
          return s + (end - start) / (1000 * 86400)
        }, 0) / closed.length
      : 0
    const satisfait = closed.filter((r) => r.resolution_satisfaisante).length
    return {
      total: reclamations.length,
      ouvertes: open.length,
      delaiMoyen: Math.round(avgDays),
      tauxResolution: closed.length > 0 ? Math.round((satisfait / closed.length) * 100) : 0,
      actionsEnCours: actions.filter((a) => ['planifiee', 'en_cours'].includes(a.status)).length,
    }
  }, [reclamations, actions])

  async function handleCreateRec(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true)
    const result = await createReclamationAction(new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Réclamation enregistrée'); setCreateRecOpen(false) }
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleStatusChange(id: string, status: ReclamationStatus, details?: Record<string, string>) {
    const result = await updateReclamationStatusAction(id, status, details)
    if (result.success) toast('success', `Statut : ${RECLAMATION_STATUS_LABELS[status]}`)
    else toast('error', result.error || 'Erreur')
  }

  async function handleCreateAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true)
    const result = await createActionAction(new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Action créée'); setCreateActionOpen(false) }
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleActionStatus(id: string, status: ActionStatus) {
    const result = await updateActionStatusAction(id, status)
    if (result.success) toast('success', 'Statut mis à jour')
    else toast('error', result.error || 'Erreur')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ?')) return
    const result = await deleteReclamationAction(id)
    if (result.success) toast('success', 'Supprimé')
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Réclamations & Amélioration</h1>
          <p className="text-surface-500 mt-1 text-sm">Qualiopi — Critère 7</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCreateActionOpen(true)} icon={<Lightbulb className="h-4 w-4" />}>Action d&apos;amélioration</Button>
          <Button onClick={() => setCreateRecOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouvelle réclamation</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="card p-4"><div className="text-xs text-surface-500">Total</div><div className="text-lg font-bold text-surface-800">{kpis.total}</div></div>
        <div className="card p-4"><div className="text-xs text-surface-500">Ouvertes</div><div className="text-lg font-bold text-danger-600">{kpis.ouvertes}</div></div>
        <div className="card p-4"><div className="text-xs text-surface-500">Délai moyen</div><div className="text-lg font-bold text-brand-600">{kpis.delaiMoyen}j</div></div>
        <div className="card p-4"><div className="text-xs text-surface-500">Taux résolution</div><div className="text-lg font-bold text-success-600">{kpis.tauxResolution}%</div></div>
        <div className="card p-4"><div className="text-xs text-surface-500">Actions en cours</div><div className="text-lg font-bold text-warning-600">{kpis.actionsEnCours}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-100 rounded-xl p-0.5 w-fit">
        {(['reclamations', 'actions'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
            {t === 'reclamations' ? `Réclamations (${reclamations.length})` : `Actions (${actions.length})`}
          </button>
        ))}
      </div>

      {/* Reclamations tab */}
      {tab === 'reclamations' && (
        <div className="space-y-3">
          {reclamations.map((r) => (
            <div key={r.id} className="card p-5 hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-brand-600">{r.numero}</span>
                    <Badge variant={RECLAMATION_STATUS_COLORS[r.status]} dot>{RECLAMATION_STATUS_LABELS[r.status]}</Badge>
                    <Badge variant={PRIORITE_COLORS[r.priorite]}>{PRIORITE_LABELS[r.priorite]}</Badge>
                    <Badge variant="default">{ORIGINE_LABELS[r.origine]}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-surface-900">{r.objet}</h3>
                  <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{r.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-2xs text-surface-400">
                    <span>Reçue le {formatDate(r.date_reception, { day: 'numeric', month: 'short' })}</span>
                    {r.emetteur_nom && <span>Par : {r.emetteur_nom}</span>}
                    {r.responsable && <span>Resp : {r.responsable.first_name} {r.responsable.last_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.status === 'recue' && (
                    <Button size="sm" onClick={() => handleStatusChange(r.id, 'en_analyse')} icon={<ArrowRight className="h-3.5 w-3.5" />}>Analyser</Button>
                  )}
                  {r.status === 'en_analyse' && (
                    <Button size="sm" onClick={() => handleStatusChange(r.id, 'action_corrective')} icon={<ArrowRight className="h-3.5 w-3.5" />}>Action corrective</Button>
                  )}
                  {r.status === 'action_corrective' && (
                    <Button size="sm" variant="secondary" onClick={() => handleStatusChange(r.id, 'cloturee', { resolution_satisfaisante: 'true' })} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Clôturer</Button>
                  )}
                  <RowMenu items={[
                    { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(r.id), danger: true },
                  ]} />
                </div>
              </div>
            </div>
          ))}
          {reclamations.length === 0 && (
            <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
              <MessageSquareWarning className="h-6 w-6 text-surface-400" />
              <p className="text-sm text-surface-500">Aucune réclamation</p>
            </div>
          )}
        </div>
      )}

      {/* Actions tab */}
      {tab === 'actions' && (
        <div className="space-y-3">
          {actions.map((a) => (
            <div key={a.id} className="card p-5 hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={ACTION_STATUS_COLORS[a.status]} dot>{ACTION_STATUS_LABELS[a.status]}</Badge>
                    <Badge variant={PRIORITE_COLORS[a.priorite]}>{PRIORITE_LABELS[a.priorite]}</Badge>
                    <Badge variant="default">{a.source}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-surface-900">{a.titre}</h3>
                  {a.description && <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-2xs text-surface-400">
                    {a.date_echeance && <span>Échéance : {formatDate(a.date_echeance, { day: 'numeric', month: 'short' })}</span>}
                    {a.responsable && <span>Resp : {a.responsable.first_name} {a.responsable.last_name}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {a.status === 'planifiee' && (
                    <Button size="sm" variant="secondary" onClick={() => handleActionStatus(a.id, 'en_cours')}>Démarrer</Button>
                  )}
                  {a.status === 'en_cours' && (
                    <Button size="sm" variant="secondary" onClick={() => handleActionStatus(a.id, 'realisee')}>Terminée</Button>
                  )}
                  {a.status === 'realisee' && (
                    <Button size="sm" onClick={() => handleActionStatus(a.id, 'verifiee')} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Vérifier</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {actions.length === 0 && (
            <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
              <Lightbulb className="h-6 w-6 text-surface-400" />
              <p className="text-sm text-surface-500">Aucune action d&apos;amélioration</p>
            </div>
          )}
        </div>
      )}

      {/* Create Reclamation */}
      <Modal isOpen={createRecOpen} onClose={() => setCreateRecOpen(false)} title="Nouvelle réclamation" size="lg">
        <form onSubmit={handleCreateRec} className="space-y-4">
          <Input name="objet" label="Objet *" placeholder="Objet de la réclamation" />
          <textarea name="description" rows={4} className="input-base resize-none" placeholder="Description détaillée..." required />
          <div className="grid grid-cols-2 gap-3">
            <Select name="origine" label="Origine" options={origineOptions} defaultValue="apprenant" />
            <Select name="priorite" label="Priorité" options={prioriteOptions} defaultValue="moyenne" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="emetteur_nom" label="Nom de l'émetteur" />
            <Input name="emetteur_email" type="email" label="Email de l'émetteur" />
          </div>
          <Select name="responsable_id" label="Responsable" options={userOptions} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateRecOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* Create Action */}
      <Modal isOpen={createActionOpen} onClose={() => setCreateActionOpen(false)} title="Nouvelle action d'amélioration">
        <form onSubmit={handleCreateAction} className="space-y-4">
          <Input name="titre" label="Titre *" placeholder="Action corrective / préventive" />
          <textarea name="description" rows={3} className="input-base resize-none" placeholder="Description de l'action..." />
          <div className="grid grid-cols-2 gap-3">
            <Select name="source" label="Source" options={sourceOptions} defaultValue="interne" />
            <Select name="priorite" label="Priorité" options={prioriteOptions} defaultValue="moyenne" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select name="responsable_id" label="Responsable" options={userOptions} />
            <Input name="date_echeance" type="date" label="Échéance" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateActionOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<Lightbulb className="h-4 w-4" />}>Créer l&apos;action</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
