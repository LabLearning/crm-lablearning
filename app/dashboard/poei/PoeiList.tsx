'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, Briefcase, Building2, GraduationCap, Trash2,
  ChevronRight, CheckCircle2, Clock, Users, CalendarClock, FolderTree,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { createPoeiAction, updatePoeiStatutAction, deletePoeiAction } from './actions'
import { POEI_STATUS_LABELS, POEI_STATUS_COLORS } from '@/lib/types/poei'
import { formatDate, cn } from '@/lib/utils'
import type { Poei, PoeiPrevision } from '@/lib/types/poei'
import { PoeiPrevisions } from './PoeiPrevisions'
import { DocumentationDrive } from './DocumentationDrive'

interface Props {
  poei: Poei[]
  previsions: PoeiPrevision[]
  clients: { id: string; raison_sociale: string | null }[]
  formations: { id: string; intitule: string; duree_heures?: number | null }[]
  hasPoeiCatalog: boolean
}


// Badge de suivi du paiement France Travail (visible des que le dossier est accordé)
function PaiementBadge({ p }: { p: any }) {
  const total = Number(p.montant_total) || 0
  const paye = Number(p.montant_paye) || 0
  const accorde = !!p.date_accord_ft || ["accorde", "en_formation", "embauche", "termine", "cloture"].includes(p.statut)
  if (p.date_paiement || (total > 0 && paye >= total)) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold mt-1">Payé</span>
  }
  if (accorde) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold mt-1">Paiement en attente</span>
  }
  return null
}

const statusOptions = Object.entries(POEI_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function PoeiList({ poei, previsions, clients, formations, hasPoeiCatalog }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState<'projets' | 'planifier' | 'documentation'>('projets')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const clientOptions = [{ value: '', label: 'Sélectionner…' }, ...clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))]
  const formationOptions = [{ value: '', label: 'Sélectionner…' }, ...formations.map((f) => ({ value: f.id, label: f.intitule }))]

  const stats = useMemo(() => ({
    total: poei.length,
    montage: poei.filter((p) => ['candidature', 'montage', 'depose'].includes(p.statut)).length,
    formation: poei.filter((p) => ['accorde', 'en_formation'].includes(p.statut)).length,
    candidats: poei.reduce((s, p) => s + (p.candidats_count || 0), 0),
  }), [poei])

  const filtered = useMemo(() => poei.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (p.numero || '').toLowerCase().includes(q) ||
      (p.client?.raison_sociale || '').toLowerCase().includes(q) ||
      (p.formation?.intitule || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.statut === statusFilter
    return matchSearch && matchStatus
  }), [poei, search, statusFilter])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createPoeiAction(fd)
    if (result.success) {
      toast('success', 'Projet POEI créé')
      setCreateOpen(false)
      if ((result.data as any)?.id) router.push(`/dashboard/poei/${(result.data as any).id}`)
      else router.refresh()
    } else if (result.errors) {
      setErrors(result.errors)
    } else {
      toast('error', result.error || 'Erreur')
    }
    setIsCreating(false)
  }

  async function handleStatut(id: string, statut: string) {
    const result = await updatePoeiStatutAction(id, statut)
    if (result.success) { toast('success', 'Statut mis à jour'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce projet POEI ?')) return
    const result = await deletePoeiAction(id)
    if (result.success) { toast('success', 'Projet supprimé'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">POEI</h1>
            <p className="text-sm text-surface-500 mt-0.5">Préparation Opérationnelle à l'Emploi — projets collectifs France Travail</p>
          </div>
        </div>
        {tab === 'projets' && (
          <Button onClick={() => { setErrors({}); setCreateOpen(true) }} icon={<Plus className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Nouveau projet</Button>
        )}
      </div>

      {/* Onglets Projets / À planifier */}
      <div className="flex items-center gap-1 border-b border-surface-200">
        {([
          { id: 'projets' as const, label: 'Projets', icon: Briefcase, count: poei.length },
          { id: 'planifier' as const, label: 'À planifier', icon: CalendarClock, count: previsions.filter((p) => !['transforme', 'abandonne'].includes(p.statut)).length },
          { id: 'documentation' as const, label: 'Documentation', icon: FolderTree, count: 0 },
        ]).map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative -mb-px border-b-2',
                active ? 'text-surface-900 border-surface-900' : 'text-surface-500 border-transparent hover:text-surface-700',
              )}>
              <Icon className="h-4 w-4" />
              {t.label}
              {t.count > 0 && (
                <span className={cn('text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md', active ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-500')}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'planifier' && <PoeiPrevisions previsions={previsions} clients={clients} />}

      {tab === 'documentation' && <DocumentationDrive clients={clients} />}

      {tab === 'projets' && (<>
      {!hasPoeiCatalog && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aucune formation marquée « Éligible POEI » dans le catalogue. Coche la case sur une fiche formation pour filtrer les programmes POEI. En attendant, toutes les formations sont proposées.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Projets', value: stats.total, icon: <Briefcase className="h-4 w-4 text-sky-500" /> },
          { label: 'En montage', value: stats.montage, icon: <Clock className="h-4 w-4 text-sky-500" /> },
          { label: 'En formation', value: stats.formation, icon: <GraduationCap className="h-4 w-4 text-sky-500" /> },
          { label: 'Candidats', value: stats.candidats, icon: <Users className="h-4 w-4 text-sky-500" /> },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">{s.label}</span>
              {s.icon}
            </div>
            <div className="text-2xl font-heading font-bold text-surface-900 mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un projet, entreprise, formation…" className="input-base pl-9 w-full" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base sm:w-56">
          <option value="all">Tous les statuts</option>
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Projet</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Formation</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Dates</th>
                <th className="text-center text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Candidats</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/poei/${p.id}`} className="block">
                      <div className="text-sm font-medium text-surface-900 inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-surface-400" />
                        {p.client?.raison_sociale || '—'}
                      </div>
                      <div className="text-xs text-surface-500">{p.numero}</div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-sm text-surface-600 max-w-[240px] truncate">{p.formation?.intitule || '—'}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-sm text-surface-500">
                    {p.date_debut ? `${formatDate(p.date_debut, { day: '2-digit', month: 'short' })}${p.date_fin ? ' → ' + formatDate(p.date_fin, { day: '2-digit', month: 'short' }) : ''}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-700 text-xs font-semibold">{p.candidats_count || 0}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div><select value={p.statut} onChange={(e) => handleStatut(p.id, e.target.value)} className="text-xs rounded-lg border border-surface-200 px-2 py-1 bg-white">
                      {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select><div><PaiementBadge p={p} /></div></div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link href={`/dashboard/poei/${p.id}`} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700"><ChevronRight className="h-4 w-4" /></Link>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-14">
            <Briefcase className="h-8 w-8 text-surface-300 mx-auto mb-2" />
            <p className="text-sm text-surface-500">Aucun projet POEI</p>
          </div>
        )}
      </div>
      </>)}

      {/* Modal création projet */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau projet POEI" size="lg">
        <form onSubmit={handleCreate} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select id="client_id" name="client_id" label="Entreprise *" options={clientOptions} error={errors.client_id?.[0]} />
            <Select id="formation_id" name="formation_id" label="Programme (formation POEI) *" options={formationOptions} error={errors.formation_id?.[0]} />
          </div>

          <div>
            <div className="section-label mb-2">Session</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input id="date_debut" name="date_debut" type="date" label="Date de début" />
              <Input id="date_fin" name="date_fin" type="date" label="Date de fin" />
              <Input id="duree_heures" name="duree_heures" type="number" label="Durée (h) — max 400" />
            </div>
          </div>

          <div>
            <div className="section-label mb-2">Financement France Travail</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input id="montant_horaire" name="montant_horaire" type="number" label="Taux horaire (€)" placeholder="8.00" />
              <Select id="statut" name="statut" label="Statut" options={statusOptions} defaultValue="montage" />
            </div>
          </div>

          <p className="text-xs text-surface-500">Les candidats s'ajoutent ensuite sur la fiche du projet.</p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<Briefcase className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Créer le projet</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
