'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Pencil, Trash2, Send, Check,
  X, FileText, ArrowRight, Euro, Calendar, Building2, Eye, Download,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import {
  createDevisAction, updateDevisStatusAction, deleteDevisAction,
  convertDevisToConventionAction, addDevisLigneAction, removeDevisLigneAction,
} from './actions'
import { DEVIS_STATUS_LABELS, DEVIS_STATUS_COLORS } from '@/lib/types/dossier'
import { formatDate } from '@/lib/utils'
import type { Devis, DevisStatus, DevisLigne } from '@/lib/types/dossier'
import type { Client } from '@/lib/types/crm'
import type { Formation } from '@/lib/types/formation'

interface DevisListProps {
  devisList: Devis[]
  clients: Pick<Client, 'id' | 'raison_sociale' | 'type' | 'nom' | 'prenom'>[]
  formations: Pick<Formation, 'id' | 'intitule' | 'reference' | 'tarif_inter_ht'>[]
}

export function DevisList({ devisList, clients, formations }: DevisListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailDevis, setDetailDevis] = useState<Devis | null>(null)

  const clientOptions = clients.map((c) => ({
    value: c.id, label: c.raison_sociale || `${c.prenom} ${c.nom}` || c.id,
  }))
  const formationOptions = [
    { value: '', label: 'Aucune' },
    ...formations.map((f) => ({ value: f.id, label: `${f.reference || ''} ${f.intitule}`.trim() })),
  ]

  const filtered = useMemo(() => {
    return devisList.filter((d) => {
      const matchSearch = d.numero.toLowerCase().includes(search.toLowerCase()) ||
        (d.objet || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.client?.raison_sociale || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || d.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [devisList, search, statusFilter])

  const totals = useMemo(() => ({
    brouillon: devisList.filter((d) => d.status === 'brouillon').reduce((s, d) => s + Number(d.montant_ttc), 0),
    envoye: devisList.filter((d) => d.status === 'envoye').reduce((s, d) => s + Number(d.montant_ttc), 0),
    accepte: devisList.filter((d) => d.status === 'accepte').reduce((s, d) => s + Number(d.montant_ttc), 0),
  }), [devisList])

  function getClientName(d: Devis): string {
    if (d.client?.raison_sociale) return d.client.raison_sociale
    if (d.client?.nom) return `${d.client.prenom || ''} ${d.client.nom}`.trim()
    return '—'
  }

  async function handleStatusChange(id: string, status: DevisStatus) {
    const result = await updateDevisStatusAction(id, status)
    if (result.success) toast('success', `Devis ${DEVIS_STATUS_LABELS[status].toLowerCase()}`)
    else toast('error', result.error || 'Erreur')
  }

  async function handleConvert(id: string) {
    const result = await convertDevisToConventionAction(id)
    if (result.success) toast('success', 'Convention créée depuis le devis')
    else toast('error', result.error || 'Erreur')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce devis ?')) return
    const result = await deleteDevisAction(id)
    if (result.success) toast('success', 'Devis supprimé')
    else toast('error', result.error || 'Erreur')
  }

  // Create form
  const [isCreating, setIsCreating] = useState(false)
  const [createErrors, setCreateErrors] = useState<Record<string, string[]>>({})
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setCreateErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createDevisAction(fd)
    if (result.success) {
      toast('success', 'Devis créé')
      setCreateOpen(false)
      setDetailDevis(result.data as Devis)
    } else if (result.errors) setCreateErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Devis</h1>
          <p className="text-surface-500 mt-1 text-sm">{devisList.length} devis</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau devis</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Brouillons', value: totals.brouillon, color: 'text-surface-600' },
          { label: 'Envoyés', value: totals.envoye, color: 'text-brand-600' },
          { label: 'Acceptés', value: totals.accepte, color: 'text-success-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-xs text-surface-500">{s.label}</div>
            <div className={`text-lg font-heading font-bold ${s.color}`}>{s.value.toLocaleString('fr-FR')} €</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', ...Object.keys(DEVIS_STATUS_LABELS)].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
              {s === 'all' ? 'Tous' : DEVIS_STATUS_LABELS[s as DevisStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">N° Devis</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Client</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Objet</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Montant TTC</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Validité</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <button onClick={() => setDetailDevis(d)} className="text-sm font-mono font-medium text-brand-600 hover:text-brand-700">
                      {d.numero}
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-surface-700">
                      <Building2 className="h-3.5 w-3.5 text-surface-400" />
                      {getClientName(d)}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 hidden md:table-cell text-sm text-surface-600 truncate max-w-[200px]">{d.objet || '—'}</td>
                  <td className="px-6 py-3.5">
                    <Badge variant={DEVIS_STATUS_COLORS[d.status]} dot>{DEVIS_STATUS_LABELS[d.status]}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right text-sm font-medium text-surface-800">
                    {Number(d.montant_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell text-sm text-surface-500">
                    {formatDate(d.date_validite, { day: 'numeric', month: 'short' })}
                    {new Date(d.date_validite) < new Date() && d.status === 'envoye' && (
                      <span className="ml-1 text-danger-500 text-xs">(expiré)</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="inline-block">
                      <RowMenu width={208} items={[
                        { label: 'Voir / Modifier', icon: <Eye className="h-4 w-4 text-surface-400" />, onClick: () => setDetailDevis(d) },
                        { label: 'Télécharger PDF', icon: <Download className="h-4 w-4 text-surface-400" />, href: `/api/pdf/devis/${d.id}`, target: '_blank' },
                        { label: 'Marquer comme envoyé', icon: <Send className="h-4 w-4 text-brand-600" />, onClick: () => handleStatusChange(d.id, 'envoye'), hidden: d.status !== 'brouillon' },
                        { label: 'Accepté', icon: <Check className="h-4 w-4 text-success-600" />, onClick: () => handleStatusChange(d.id, 'accepte'), hidden: d.status !== 'envoye' },
                        { label: 'Refusé', icon: <X className="h-4 w-4" />, onClick: () => handleStatusChange(d.id, 'refuse'), danger: true, hidden: d.status !== 'envoye' },
                        { label: 'Créer convention', icon: <ArrowRight className="h-4 w-4 text-success-600" />, onClick: () => handleConvert(d.id), hidden: d.status !== 'accepte' },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(d.id), danger: true, hidden: d.status !== 'brouillon' },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-surface-500">Aucun devis trouvé</div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau devis" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select id="client_id" name="client_id" label="Client *" options={clientOptions} placeholder="Sélectionner" error={createErrors.client_id?.[0]} />
          <Select id="formation_id" name="formation_id" label="Formation liée" options={formationOptions} />
          <Input id="objet" name="objet" label="Objet *" placeholder="Formation Management — 3 jours" error={createErrors.objet?.[0]} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="date_validite" name="date_validite" type="date" label="Date de validité *"
              defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}
              error={createErrors.date_validite?.[0]} />
            <Input id="remise_pourcent" name="remise_pourcent" type="number" label="Remise (%)" defaultValue="0" />
          </div>
          <textarea id="conditions_particulieres" name="conditions_particulieres" rows={2} className="input-base resize-none" placeholder="Conditions particulières..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<FileText className="h-4 w-4" />}>Créer le devis</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal (with line items) */}
      <Modal isOpen={!!detailDevis} onClose={() => setDetailDevis(null)} title={detailDevis?.numero || ''} size="lg">
        {detailDevis && <DevisDetail devis={detailDevis} onClose={() => setDetailDevis(null)} />}
      </Modal>
    </div>
  )
}

// ---- Devis Detail with line items ----

function DevisDetail({ devis, onClose }: { devis: Devis; onClose: () => void }) {
  const { toast } = useToast()
  const [addingLine, setAddingLine] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleAddLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const result = await addDevisLigneAction(devis.id, fd)
    if (result.success) { toast('success', 'Ligne ajoutée'); setAddingLine(false); (e.target as HTMLFormElement).reset() }
    else toast('error', result.error || 'Erreur')
    setIsSaving(false)
  }

  async function handleRemoveLine(ligneId: string) {
    const result = await removeDevisLigneAction(ligneId, devis.id)
    if (result.success) toast('success', 'Ligne supprimée')
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-surface-50">
          <div className="text-2xs text-surface-400">Client</div>
          <div className="text-sm font-medium text-surface-800">{devis.client?.raison_sociale || '—'}</div>
        </div>
        <div className="p-3 rounded-xl bg-surface-50">
          <div className="text-2xs text-surface-400">Statut</div>
          <Badge variant={DEVIS_STATUS_COLORS[devis.status]} dot>{DEVIS_STATUS_LABELS[devis.status]}</Badge>
        </div>
        <div className="p-3 rounded-xl bg-surface-50">
          <div className="text-2xs text-surface-400">Date d&apos;émission</div>
          <div className="text-sm text-surface-800">{formatDate(devis.date_emission)}</div>
        </div>
        <div className="p-3 rounded-xl bg-surface-50">
          <div className="text-2xs text-surface-400">Validité</div>
          <div className="text-sm text-surface-800">{formatDate(devis.date_validite)}</div>
        </div>
      </div>

      {devis.objet && <div className="p-3 rounded-xl bg-surface-50"><div className="text-2xs text-surface-400">Objet</div><div className="text-sm text-surface-800">{devis.objet}</div></div>}

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-surface-800">Lignes du devis</h3>
          {devis.status === 'brouillon' && (
            <Button size="sm" variant="secondary" onClick={() => setAddingLine(!addingLine)} icon={<Plus className="h-3.5 w-3.5" />}>
              Ajouter une ligne
            </Button>
          )}
        </div>

        {addingLine && (
          <form onSubmit={handleAddLine} className="card p-3 mb-3 space-y-2">
            <Input name="designation" label="Désignation *" placeholder="Formation Management — 3 jours" />
            <div className="grid grid-cols-3 gap-2">
              <Input name="quantite" type="number" label="Quantité" defaultValue="1" />
              <Select name="unite" label="Unité" options={[
                { value: 'forfait', label: 'Forfait' }, { value: 'heure', label: 'Heure' },
                { value: 'jour', label: 'Jour' }, { value: 'personne', label: 'Personne' },
              ]} defaultValue="forfait" />
              <Input name="prix_unitaire_ht" type="number" label="PU HT (€)" placeholder="0" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" type="button" onClick={() => setAddingLine(false)}>Annuler</Button>
              <Button size="sm" type="submit" isLoading={isSaving}>Ajouter</Button>
            </div>
          </form>
        )}

        {(devis.lignes || []).length > 0 ? (
          <div className="border border-surface-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Désignation</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-surface-500">Qté</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-surface-500">PU HT</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-surface-500">Total HT</th>
                  {devis.status === 'brouillon' && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {(devis.lignes || []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-surface-800">{l.designation}</td>
                    <td className="px-3 py-2 text-right text-surface-600">{l.quantite} {l.unite}</td>
                    <td className="px-3 py-2 text-right text-surface-600">{Number(l.prix_unitaire_ht).toLocaleString('fr-FR')} €</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-800">{Number(l.montant_ht).toLocaleString('fr-FR')} €</td>
                    {devis.status === 'brouillon' && (
                      <td className="px-1 py-2">
                        <button onClick={() => handleRemoveLine(l.id)} className="p-1 rounded text-surface-400 hover:text-danger-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-surface-400 bg-surface-50 rounded-xl">
            Aucune ligne. Ajoutez des lignes pour compléter le devis.
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-surface-200 pt-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-surface-500">Sous-total HT</span>
          <span className="text-surface-700">{(Number(devis.montant_ht) + Number(devis.remise_montant)).toLocaleString('fr-FR')} €</span>
        </div>
        {Number(devis.remise_montant) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-surface-500">Remise ({devis.remise_pourcent}%)</span>
            <span className="text-danger-600">-{Number(devis.remise_montant).toLocaleString('fr-FR')} €</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-surface-500">Total HT</span>
          <span className="font-medium text-surface-800">{Number(devis.montant_ht).toLocaleString('fr-FR')} €</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-surface-500">TVA ({devis.taux_tva}%)</span>
          <span className="text-surface-700">{Number(devis.montant_tva).toLocaleString('fr-FR')} €</span>
        </div>
        <div className="flex justify-between text-base font-semibold pt-1 border-t border-surface-200">
          <span className="text-surface-800">Total TTC</span>
          <span className="text-surface-900">{Number(devis.montant_ttc).toLocaleString('fr-FR')} €</span>
        </div>
      </div>
    </div>
  )
}
