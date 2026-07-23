'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff,
  GraduationCap, Award, Tag, ArrowUp, ArrowDown, ChevronsUpDown,
} from 'lucide-react'
import { Button, Badge, Modal, useToast, RowMenu } from '@/components/ui'
import { FormationForm } from './FormationForm'
import { deleteFormationAction, toggleFormationAction } from './actions'
import { MODALITE_LABELS, MODALITE_COLORS } from '@/lib/types/formation'
import type { Formation } from '@/lib/types/formation'

interface FormationsListProps {
  formations: Formation[]
  readOnly?: boolean
}

type SortKey = 'intitule' | 'categorie' | 'duree' | 'prix' | 'apprenants'

// En-tête de colonne triable : clic pour trier, flèche indiquant le sens actif
function SortHeader({ label, k, sort, onSort, className = '' }: {
  label: string
  k: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort.key === k
  const alignRight = className.includes('text-right')
  return (
    <th className={`py-2.5 px-3 text-2xs font-semibold uppercase tracking-wider ${active ? 'text-surface-700' : 'text-surface-400'} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-surface-700 transition-colors ${alignRight ? 'flex-row-reverse' : ''}`}
      >
        {label}
        {active
          ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ChevronsUpDown className="h-3 w-3 text-surface-300" />}
      </button>
    </th>
  )
}

export function FormationsList({ formations, readOnly }: FormationsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterCat, setFilterCat] = useState('')
  const [filterModalite, setFilterModalite] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editFormation, setEditFormation] = useState<Formation | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'intitule', dir: 'asc' })

  // Clic sur un en-tête : même colonne → inverse le sens ; sinon tri croissant
  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  // Catégories présentes au catalogue (pour le filtre)
  const categories = useMemo(
    () => Array.from(new Set(formations.map((f) => f.categorie).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'fr')),
    [formations],
  )
  const modalites = useMemo(
    () => Array.from(new Set(formations.map((f) => f.modalite).filter(Boolean))),
    [formations],
  )

  const filtered = useMemo(() => {
    return formations.filter((f) => {
      const matchSearch = f.intitule.toLowerCase().includes(search.toLowerCase()) ||
        (f.reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.categorie || '').toLowerCase().includes(search.toLowerCase())
      const matchActive = filterActive === 'all' || (filterActive === 'active' ? f.is_active : !f.is_active)
      const matchCat = !filterCat || f.categorie === filterCat
      const matchMod = !filterModalite || f.modalite === filterModalite
      return matchSearch && matchActive && matchCat && matchMod
    })
  }, [formations, search, filterActive, filterCat, filterModalite])

  const sorted = useMemo(() => {
    const mul = sort.dir === 'asc' ? 1 : -1
    const val = (f: Formation): string | number => {
      switch (sort.key) {
        case 'duree': return Number(f.duree_heures) || 0
        case 'prix': return Number(f.tarif_inter_ht) || 0
        case 'apprenants': return Number(f.nombre_apprenants_total) || 0
        case 'categorie': return (f.categorie || '').toLowerCase()
        default: return (f.intitule || '').toLowerCase()
      }
    }
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return -1 * mul
      if (va > vb) return 1 * mul
      return 0
    })
  }, [filtered, sort])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette formation ?')) return
    const result = await deleteFormationAction(id)
    if (result.success) toast('success', 'Formation supprimée')
    else toast('error', result.error || 'Erreur')
  }

  async function handleToggle(id: string, current: boolean) {
    const result = await toggleFormationAction(id, !current)
    if (result.success) toast('success', !current ? 'Formation activée' : 'Formation désactivée')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Catalogue de formations</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {formations.length} formation{formations.length > 1 ? 's' : ''} au catalogue
          </p>
        </div>
        {!readOnly && (
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Nouvelle formation
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une formation..." className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <select
          value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border border-surface-200/80 bg-white px-3 py-2 text-xs font-medium text-surface-600 focus:outline-none focus:border-surface-300"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c as string} value={c as string}>{c as string}</option>)}
        </select>
        <select
          value={filterModalite} onChange={(e) => setFilterModalite(e.target.value)}
          className="rounded-xl border border-surface-200/80 bg-white px-3 py-2 text-xs font-medium text-surface-600 focus:outline-none focus:border-surface-300"
        >
          <option value="">Toutes modalités</option>
          {modalites.map((m) => <option key={m} value={m}>{MODALITE_LABELS[m]}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button key={f} onClick={() => setFilterActive(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filterActive === f ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
              {f === 'all' ? 'Toutes' : f === 'active' ? 'Actives' : 'Inactives'}
            </button>
          ))}
        </div>
        {(filterCat || filterModalite) && (
          <button onClick={() => { setFilterCat(''); setFilterModalite('') }}
            className="text-xs font-medium text-surface-400 hover:text-surface-600 underline underline-offset-2">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau — formations en lignes, colonnes triables */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50/60">
                <SortHeader label="Formation" k="intitule" sort={sort} onSort={toggleSort} className="text-left pl-4" />
                <SortHeader label="Catégorie" k="categorie" sort={sort} onSort={toggleSort} className="text-left" />
                <th className="py-2.5 px-3 text-left text-2xs font-semibold uppercase tracking-wider text-surface-400">Modalité</th>
                <SortHeader label="Durée" k="duree" sort={sort} onSort={toggleSort} className="text-right" />
                <SortHeader label="Prix inter" k="prix" sort={sort} onSort={toggleSort} className="text-right" />
                <SortHeader label="Apprenants" k="apprenants" sort={sort} onSort={toggleSort} className="text-right" />
                <th className="py-2.5 px-3 text-left text-2xs font-semibold uppercase tracking-wider text-surface-400">État</th>
                {!readOnly && <th className="py-2.5 px-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => router.push(`/dashboard/formations/${f.id}`)}
                  className={`border-b border-surface-100 last:border-0 hover:bg-surface-50/70 cursor-pointer transition-colors ${!f.is_active ? 'opacity-55' : ''}`}
                >
                  <td className="py-2.5 pl-4 pr-3 max-w-[320px]">
                    {f.reference && <div className="text-2xs font-mono text-surface-400 leading-none mb-0.5">{f.reference}</div>}
                    <div className="font-medium text-surface-900 truncate">{f.intitule}</div>
                    {f.sous_titre && <div className="text-xs text-surface-500 truncate">{f.sous_titre}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    {f.categorie
                      ? <Badge variant="default"><Tag className="h-3 w-3 mr-0.5" />{f.categorie}</Badge>
                      : <span className="text-surface-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant={MODALITE_COLORS[f.modalite]}>{MODALITE_LABELS[f.modalite]}</Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    <span className="font-medium text-surface-800">{f.duree_heures}h</span>
                    {f.duree_jours ? <span className="text-surface-400"> · {f.duree_jours}j</span> : null}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {f.tarif_inter_ht
                      ? <span className="text-surface-800">{Number(f.tarif_inter_ht).toLocaleString('fr-FR')} €</span>
                      : <span className="text-surface-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-surface-600">{f.nombre_apprenants_total}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {f.est_certifiante && <Badge variant="success"><Award className="h-3 w-3 mr-0.5" />Certif.</Badge>}
                      {f.is_active
                        ? (f.is_published ? <Badge variant="info">Publiée</Badge> : <Badge variant="default">Active</Badge>)
                        : <Badge variant="default">Inactive</Badge>}
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <RowMenu items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditFormation(f) },
                        {
                          label: f.is_active ? 'Désactiver' : 'Activer',
                          icon: f.is_active ? <EyeOff className="h-4 w-4 text-surface-400" /> : <Eye className="h-4 w-4 text-surface-400" />,
                          onClick: () => handleToggle(f.id, f.is_active),
                        },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(f.id), danger: true },
                      ]} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <GraduationCap className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">
            {search ? 'Aucune formation trouvée' : 'Aucune formation au catalogue. Créez votre première formation !'}
          </p>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle formation" size="lg">
        <FormationForm onSuccess={() => { setCreateOpen(false); toast('success', 'Formation créée') }} onCancel={() => setCreateOpen(false)} />
      </Modal>
      <Modal isOpen={!!editFormation} onClose={() => setEditFormation(null)} title="Modifier la formation" size="lg">
        {editFormation && <FormationForm formation={editFormation} onSuccess={() => { setEditFormation(null); toast('success', 'Formation mise à jour') }} onCancel={() => setEditFormation(null)} />}
      </Modal>
    </div>
  )
}
