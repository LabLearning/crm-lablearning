'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, Briefcase, Building2, GraduationCap, Trash2,
  ChevronRight, CheckCircle2, Clock, Users,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { createPoeiAction, updatePoeiStatutAction, deletePoeiAction } from './actions'
import { POEI_STATUS_LABELS, POEI_STATUS_COLORS, POEI_WORKFLOW, TYPE_CONTRAT_LABELS } from '@/lib/types/poei'
import { formatDate } from '@/lib/utils'
import type { Poei, PoeiStatus } from '@/lib/types/poei'

interface Props {
  poei: Poei[]
  clients: { id: string; raison_sociale: string | null }[]
  formations: { id: string; intitule: string }[]
  sessions: any[]
}

const statusOptions = Object.entries(POEI_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
const contratOptions = [{ value: '', label: '—' }, ...Object.entries(TYPE_CONTRAT_LABELS).map(([v, l]) => ({ value: v, label: l }))]

export function PoeiList({ poei, clients, formations, sessions }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const clientOptions = [{ value: '', label: 'Aucun' }, ...clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))]
  const formationOptions = [{ value: '', label: 'Aucune' }, ...formations.map((f) => ({ value: f.id, label: f.intitule }))]
  const sessionOptions = [{ value: '', label: 'Aucune' }, ...sessions.map((s) => {
    const d = s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
    return { value: s.id, label: [s.intitule || s.reference || 'Session', d ? `(${d})` : ''].filter(Boolean).join(' ') }
  })]

  const stats = useMemo(() => ({
    total: poei.length,
    montage: poei.filter((p) => ['candidature', 'montage', 'depose'].includes(p.statut)).length,
    formation: poei.filter((p) => ['accorde', 'en_formation'].includes(p.statut)).length,
    embauche: poei.filter((p) => p.statut === 'embauche').length,
  }), [poei])

  const filtered = useMemo(() => poei.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      `${p.candidat_prenom || ''} ${p.candidat_nom}`.toLowerCase().includes(q) ||
      (p.numero || '').toLowerCase().includes(q) ||
      (p.client?.raison_sociale || '').toLowerCase().includes(q) ||
      (p.poste_vise || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.statut === statusFilter
    return matchSearch && matchStatus
  }), [poei, search, statusFilter])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createPoeiAction(fd)
    if (result.success) {
      toast('success', 'POEI créée')
      setCreateOpen(false)
      router.refresh()
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
    if (!confirm('Supprimer cette POEI ?')) return
    const result = await deletePoeiAction(id)
    if (result.success) { toast('success', 'POEI supprimée'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  const candidatNom = (p: Poei) => `${p.candidat_prenom || ''} ${p.candidat_nom}`.trim()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">POEI</h1>
          <p className="text-sm text-surface-500 mt-0.5">Préparation Opérationnelle à l'Emploi Individuelle — France Travail</p>
        </div>
        <Button onClick={() => { setErrors({}); setCreateOpen(true) }} icon={<Plus className="h-4 w-4" />}>Nouvelle POEI</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: <Briefcase className="h-4 w-4 text-brand-500" /> },
          { label: 'En montage', value: stats.montage, icon: <Clock className="h-4 w-4 text-amber-500" /> },
          { label: 'En formation', value: stats.formation, icon: <GraduationCap className="h-4 w-4 text-indigo-500" /> },
          { label: 'Embauchés', value: stats.embauche, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un candidat, employeur, poste…"
            className="input-base pl-9 w-full"
          />
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
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Candidat</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Employeur</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Formation</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/poei/${p.id}`} className="block">
                      <div className="text-sm font-medium text-surface-900">{candidatNom(p) || '—'}</div>
                      <div className="text-xs text-surface-500">
                        {p.numero}{p.poste_vise ? ` · ${p.poste_vise}` : ''}
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-sm text-surface-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-surface-400" />
                      {p.client?.raison_sociale || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell text-sm text-surface-600 max-w-[220px] truncate">
                    {p.formation?.intitule || '—'}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={p.statut}
                      onChange={(e) => handleStatut(p.id, e.target.value)}
                      className="text-xs rounded-lg border border-surface-200 px-2 py-1 bg-white"
                    >
                      {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link href={`/dashboard/poei/${p.id}`} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-14">
            <Users className="h-8 w-8 text-surface-300 mx-auto mb-2" />
            <p className="text-sm text-surface-500">Aucune POEI</p>
          </div>
        )}
      </div>

      {/* Modal création */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle POEI" size="lg">
        <form onSubmit={handleCreate} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Candidat */}
          <div>
            <div className="section-label mb-2">Candidat (demandeur d'emploi)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Select id="candidat_civilite" name="candidat_civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} />
              <Input id="candidat_prenom" name="candidat_prenom" label="Prénom" className="sm:col-span-1" />
              <Input id="candidat_nom" name="candidat_nom" label="Nom *" error={errors.candidat_nom?.[0]} className="sm:col-span-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <Input id="candidat_email" name="candidat_email" type="email" label="Email" />
              <Input id="candidat_telephone" name="candidat_telephone" label="Téléphone" />
              <Input id="candidat_identifiant_ft" name="candidat_identifiant_ft" label="Identifiant France Travail" />
            </div>
          </div>

          {/* Employeur + poste */}
          <div>
            <div className="section-label mb-2">Employeur & poste</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select id="client_id" name="client_id" label="Employeur" options={clientOptions} />
              <Input id="poste_vise" name="poste_vise" label="Poste visé" />
              <Select id="type_contrat" name="type_contrat" label="Type de contrat" options={contratOptions} />
              <Input id="date_embauche_prevue" name="date_embauche_prevue" type="date" label="Date d'embauche prévue" />
              <Input id="tuteur_nom" name="tuteur_nom" label="Tuteur" className="sm:col-span-2" />
            </div>
          </div>

          {/* Formation */}
          <div>
            <div className="section-label mb-2">Formation</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select id="formation_id" name="formation_id" label="Formation" options={formationOptions} />
              <Select id="session_id" name="session_id" label="Session" options={sessionOptions} />
              <Input id="duree_heures" name="duree_heures" type="number" label="Durée (h) — max 400" />
              <div className="grid grid-cols-2 gap-3">
                <Input id="date_debut" name="date_debut" type="date" label="Début" />
                <Input id="date_fin" name="date_fin" type="date" label="Fin" />
              </div>
            </div>
          </div>

          {/* Financement France Travail */}
          <div>
            <div className="section-label mb-2">Financement France Travail</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input id="montant_horaire" name="montant_horaire" type="number" label="Taux horaire (€)" placeholder="8.00" />
              <Input id="numero_dossier_ft" name="numero_dossier_ft" label="N° dossier France Travail" />
              <Select id="statut" name="statut" label="Statut" options={statusOptions} defaultValue="prospect" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<Briefcase className="h-4 w-4" />}>Créer la POEI</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
