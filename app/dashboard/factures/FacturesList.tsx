'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Send, Trash2, Eye,
  Receipt, Building2, Euro, Calendar, AlertTriangle,
  CreditCard, ArrowRight, FileX, Clock, Download, Banknote, Loader2,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import {
  createFactureAction, updateFactureStatusAction, deleteFactureAction,
  addFactureLigneAction, removeFactureLigneAction,
  createPaiementAction, createAvoirAction,
} from './actions'
import { cederFactureAction } from '../affacturage/actions'
import { FACTURE_STATUS_LABELS, FACTURE_STATUS_COLORS, FACTURE_TYPE_LABELS, PAIEMENT_MODE_LABELS, PAIEMENT_STATUS_COLORS, PAIEMENT_STATUS_LABELS } from '@/lib/types/facture'
import { FINANCEUR_LABELS } from '@/lib/types/crm'
import { formatDate } from '@/lib/utils'
import type { Facture, FactureStatus, Paiement } from '@/lib/types/facture'
import type { Client } from '@/lib/types/crm'

interface FacturesListProps {
  factures: Facture[]
  clients: Pick<Client, 'id' | 'raison_sociale' | 'nom' | 'prenom' | 'type'>[]
  affactureurs?: { id: string; raison_sociale: string; taux_commission_default: number; taux_retenue_default: number }[]
}

export function FacturesList({ factures, clients, affactureurs = [] }: FacturesListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailFacture, setDetailFacture] = useState<Facture | null>(null)
  const [paiementFacture, setPaiementFacture] = useState<Facture | null>(null)
  const [cessionFacture, setCessionFacture] = useState<Facture | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const clientOptions = clients.map((c) => ({
    value: c.id, label: c.raison_sociale || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.id,
  }))

  const financeurOpts = [{ value: '', label: 'Aucun' }, ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l }))]

  const filtered = useMemo(() => {
    return factures.filter((f) => {
      const matchSearch = f.numero.toLowerCase().includes(search.toLowerCase()) ||
        (f.objet || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.client?.raison_sociale || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || f.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [factures, search, statusFilter])

  // Dashboard stats
  const stats = useMemo(() => {
    const active = factures.filter((f) => !['brouillon', 'annulee'].includes(f.status))
    return {
      ca_total: active.filter((f) => f.type !== 'avoir').reduce((s, f) => s + Number(f.montant_ttc), 0),
      encaisse: active.reduce((s, f) => s + Number(f.montant_paye), 0),
      en_attente: active.filter((f) => ['emise', 'envoyee', 'payee_partiellement'].includes(f.status)).reduce((s, f) => s + Number(f.montant_restant), 0),
      en_retard: factures.filter((f) => f.status === 'en_retard' || (
        ['emise', 'envoyee', 'payee_partiellement'].includes(f.status) && new Date(f.date_echeance) < new Date()
      )).reduce((s, f) => s + Number(f.montant_restant), 0),
    }
  }, [factures])

  function getClientName(f: Facture): string {
    if (f.client?.raison_sociale) return f.client.raison_sociale
    return `${f.client?.prenom || ''} ${f.client?.nom || ''}`.trim() || '—'
  }

  function isOverdue(f: Facture): boolean {
    return ['emise', 'envoyee', 'payee_partiellement'].includes(f.status) && new Date(f.date_echeance) < new Date()
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createFactureAction(fd)
    if (result.success) { toast('success', 'Facture créée'); setCreateOpen(false); setDetailFacture(result.data as Facture) }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleStatus(id: string, status: FactureStatus) {
    const result = await updateFactureStatusAction(id, status)
    if (result.success) toast('success', `Facture ${FACTURE_STATUS_LABELS[status].toLowerCase()}`)
    else toast('error', result.error || 'Erreur')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce brouillon ?')) return
    const result = await deleteFactureAction(id)
    if (result.success) toast('success', 'Facture supprimée')
    else toast('error', result.error || 'Erreur')
  }

  async function handleAvoir(id: string) {
    if (!confirm('Créer un avoir pour annuler cette facture ?')) return
    const result = await createAvoirAction(id)
    if (result.success) toast('success', 'Avoir créé, facture annulée')
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Facturation</h1>
          <p className="text-surface-500 mt-1 text-sm">{factures.length} facture{factures.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouvelle facture</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'CA Facturé', value: stats.ca_total, icon: Euro, color: 'text-surface-800', bg: 'bg-surface-50' },
          { label: 'Encaissé', value: stats.encaisse, icon: CreditCard, color: 'text-success-600', bg: 'bg-success-50' },
          { label: 'En attente', value: stats.en_attente, icon: Clock, color: 'text-brand-600', bg: 'bg-brand-50' },
          { label: 'En retard', value: stats.en_retard, icon: AlertTriangle, color: 'text-danger-600', bg: 'bg-danger-50' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
              <div>
                <div className="text-xs text-surface-500">{s.label}</div>
                <div className={`text-lg font-heading font-bold ${s.color}`}>{s.value.toLocaleString('fr-FR')} €</div>
              </div>
            </div>
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
          {['all', 'brouillon', 'envoyee', 'payee_partiellement', 'payee', 'en_retard'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
              {s === 'all' ? 'Toutes' : FACTURE_STATUS_LABELS[s as FactureStatus]}
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
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">N° Facture</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Client</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Objet</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Montant</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Reste dû</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Échéance</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((f) => (
                <tr key={f.id} className={`hover:bg-surface-50/50 transition-colors ${isOverdue(f) ? 'bg-danger-50/30' : ''}`}>
                  <td className="px-6 py-3.5">
                    <button onClick={() => setDetailFacture(f)} className="text-sm font-mono font-medium text-brand-600 hover:text-brand-700">
                      {f.numero}
                    </button>
                    {f.type !== 'facture' && <Badge variant={f.type === 'avoir' ? 'danger' : 'warning'} className="ml-1">{FACTURE_TYPE_LABELS[f.type]}</Badge>}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-surface-700">{getClientName(f)}</td>
                  <td className="px-6 py-3.5 hidden md:table-cell text-sm text-surface-600 truncate max-w-[180px]">{f.objet || '—'}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={isOverdue(f) ? 'danger' : FACTURE_STATUS_COLORS[f.status]} dot>
                        {isOverdue(f) ? 'En retard' : FACTURE_STATUS_LABELS[f.status]}
                      </Badge>
                      {f.affacturage_status && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          f.affacturage_status === 'soldee' ? 'bg-emerald-50 text-emerald-700' :
                          f.affacturage_status === 'avancee' ? 'bg-blue-50 text-blue-700' :
                          f.affacturage_status === 'impayee' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          <Banknote className="h-2.5 w-2.5" />
                          {f.affacturage_status === 'cedee' ? 'Cédée' :
                           f.affacturage_status === 'avancee' ? 'Avancée' :
                           f.affacturage_status === 'soldee' ? 'Factor soldé' : 'Factor impayé'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right text-sm font-medium text-surface-800">
                    {Number(f.montant_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-6 py-3.5 text-right hidden lg:table-cell">
                    {Number(f.montant_restant) > 0 ? (
                      <span className="text-sm font-medium text-danger-600">{Number(f.montant_restant).toLocaleString('fr-FR')} €</span>
                    ) : f.status === 'payee' ? (
                      <span className="text-sm text-success-600">Soldée</span>
                    ) : <span className="text-sm text-surface-400">—</span>}
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell">
                    <span className={`text-sm ${isOverdue(f) ? 'text-danger-600 font-medium' : 'text-surface-500'}`}>
                      {formatDate(f.date_echeance, { day: 'numeric', month: 'short' })}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <RowMenu
                      width={208}
                      items={[
                        { label: 'Voir le détail', icon: <Eye className="h-4 w-4 text-surface-400" />, onClick: () => setDetailFacture(f) },
                        { label: 'Télécharger PDF', icon: <Download className="h-4 w-4 text-surface-400" />, href: `/api/pdf/facture/${f.id}`, target: '_blank' },
                        { label: 'Émettre', icon: <Receipt className="h-4 w-4 text-brand-600" />, onClick: () => handleStatus(f.id, 'emise'), hidden: f.status !== 'brouillon' },
                        { label: 'Marquer envoyée', icon: <Send className="h-4 w-4 text-brand-600" />, onClick: () => handleStatus(f.id, 'envoyee'), hidden: f.status !== 'emise' },
                        {
                          label: 'Enregistrer un paiement',
                          icon: <CreditCard className="h-4 w-4 text-success-600" />,
                          onClick: () => setPaiementFacture(f),
                          hidden: !['emise', 'envoyee', 'payee_partiellement', 'en_retard'].includes(f.status),
                        },
                        {
                          label: "Céder à l'affacturage",
                          icon: <Banknote className="h-4 w-4 text-amber-600" />,
                          onClick: () => {
                            if (affactureurs.length === 0) {
                              toast('error', 'Ajoutez d\'abord un affactureur dans /dashboard/affacturage')
                              return
                            }
                            setCessionFacture(f)
                          },
                          hidden: !(['emise', 'envoyee', 'payee_partiellement', 'en_retard'].includes(f.status) && !f.affacturage_status && f.type !== 'avoir'),
                        },
                        {
                          label: 'Créer un avoir',
                          icon: <FileX className="h-4 w-4 text-warning-600" />,
                          onClick: () => handleAvoir(f.id),
                          hidden: !(!['brouillon', 'annulee'].includes(f.status) && f.type !== 'avoir'),
                        },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(f.id), hidden: f.status !== 'brouillon' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-sm text-surface-500">Aucune facture trouvée</div>}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle facture" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select id="type" name="type" label="Type" options={Object.entries(FACTURE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} defaultValue="facture" />
            <Select id="client_id" name="client_id" label="Client *" options={clientOptions} placeholder="Sélectionner" error={errors.client_id?.[0]} />
          </div>
          <Input id="objet" name="objet" label="Objet *" placeholder="Formation Management — Facture de solde" error={errors.objet?.[0]} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="date_echeance" name="date_echeance" type="date" label="Échéance *"
              defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]} error={errors.date_echeance?.[0]} />
            <Input id="taux_tva" name="taux_tva" type="number" label="TVA (%)" defaultValue="20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="financeur_type" name="financeur_type" label="Financeur" options={financeurOpts} />
            <Input id="financeur_nom" name="financeur_nom" label="Nom financeur" />
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" name="subrogation" value="true" className="rounded border-surface-300" />
            Subrogation de paiement (paiement direct par le financeur)
          </label>
          <Input id="conditions_paiement" name="conditions_paiement" label="Conditions de paiement" defaultValue="Paiement à 30 jours" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<Receipt className="h-4 w-4" />}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detailFacture} onClose={() => setDetailFacture(null)} title={detailFacture?.numero || ''} size="lg">
        {detailFacture && <FactureDetail facture={detailFacture} onRecordPayment={() => { setPaiementFacture(detailFacture); setDetailFacture(null) }} />}
      </Modal>

      {/* Paiement Modal */}
      <Modal isOpen={!!paiementFacture} onClose={() => setPaiementFacture(null)} title={`Paiement — ${paiementFacture?.numero || ''}`}>
        {paiementFacture && <PaiementForm facture={paiementFacture} onDone={() => setPaiementFacture(null)} />}
      </Modal>

      {/* Cession Affacturage Modal */}
      <Modal isOpen={!!cessionFacture} onClose={() => setCessionFacture(null)} title={`Céder à l'affacturage — ${cessionFacture?.numero || ''}`}>
        {cessionFacture && (
          <CessionForm
            facture={cessionFacture}
            affactureurs={affactureurs}
            onDone={() => setCessionFacture(null)}
          />
        )}
      </Modal>
    </div>
  )
}

// ---- Facture Detail ----

function FactureDetail({ facture, onRecordPayment }: { facture: Facture; onRecordPayment: () => void }) {
  const { toast } = useToast()
  const [addingLine, setAddingLine] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleAddLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const result = await addFactureLigneAction(facture.id, new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Ligne ajoutée'); setAddingLine(false) }
    else toast('error', result.error || 'Erreur')
    setIsSaving(false)
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-surface-50"><div className="text-2xs text-surface-400">Client</div><div className="text-sm font-medium">{facture.client?.raison_sociale || '—'}</div></div>
        <div className="p-3 rounded-xl bg-surface-50"><div className="text-2xs text-surface-400">Statut</div><Badge variant={FACTURE_STATUS_COLORS[facture.status]} dot>{FACTURE_STATUS_LABELS[facture.status]}</Badge></div>
        <div className="p-3 rounded-xl bg-surface-50"><div className="text-2xs text-surface-400">Émission</div><div className="text-sm">{formatDate(facture.date_emission)}</div></div>
        <div className="p-3 rounded-xl bg-surface-50"><div className="text-2xs text-surface-400">Échéance</div><div className="text-sm">{formatDate(facture.date_echeance)}</div></div>
      </div>

      {facture.financeur_type && (
        <div className="p-3 rounded-xl bg-warning-50 border border-warning-200">
          <div className="text-xs font-medium text-warning-700">Financeur : {FINANCEUR_LABELS[facture.financeur_type as keyof typeof FINANCEUR_LABELS] || facture.financeur_type} — {facture.financeur_nom || ''}</div>
          {facture.subrogation && <div className="text-2xs text-warning-600 mt-0.5">Subrogation : paiement direct par le financeur</div>}
        </div>
      )}

      {/* Lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-surface-800">Lignes</h3>
          {facture.status === 'brouillon' && (
            <Button size="sm" variant="secondary" onClick={() => setAddingLine(!addingLine)} icon={<Plus className="h-3.5 w-3.5" />}>Ajouter</Button>
          )}
        </div>

        {addingLine && (
          <form onSubmit={handleAddLine} className="card p-3 mb-3 space-y-2">
            <Input name="designation" label="Désignation *" />
            <div className="grid grid-cols-3 gap-2">
              <Input name="quantite" type="number" label="Qté" defaultValue="1" />
              <Select name="unite" label="Unité" options={[{ value: 'forfait', label: 'Forfait' }, { value: 'heure', label: 'Heure' }, { value: 'jour', label: 'Jour' }, { value: 'personne', label: 'Personne' }]} defaultValue="forfait" />
              <Input name="prix_unitaire_ht" type="number" label="PU HT (€)" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" type="button" onClick={() => setAddingLine(false)}>Annuler</Button>
              <Button size="sm" type="submit" isLoading={isSaving}>Ajouter</Button>
            </div>
          </form>
        )}

        {(facture.lignes || []).length > 0 ? (
          <div className="border border-surface-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-50 border-b"><th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Désignation</th><th className="text-right px-3 py-2 text-xs font-medium text-surface-500">Qté</th><th className="text-right px-3 py-2 text-xs font-medium text-surface-500">PU HT</th><th className="text-right px-3 py-2 text-xs font-medium text-surface-500">Total HT</th></tr></thead>
              <tbody className="divide-y divide-surface-100">
                {(facture.lignes || []).map((l) => (
                  <tr key={l.id}><td className="px-3 py-2">{l.designation}</td><td className="px-3 py-2 text-right text-surface-600">{l.quantite}</td><td className="px-3 py-2 text-right text-surface-600">{Number(l.prix_unitaire_ht).toLocaleString('fr-FR')} €</td><td className="px-3 py-2 text-right font-medium">{Number(l.montant_ht).toLocaleString('fr-FR')} €</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-center py-4 text-xs text-surface-400 bg-surface-50 rounded-xl">Aucune ligne</div>}
      </div>

      {/* Totals */}
      <div className="border-t pt-3 space-y-1">
        <div className="flex justify-between text-sm"><span className="text-surface-500">Total HT</span><span className="font-medium">{Number(facture.montant_ht).toLocaleString('fr-FR')} €</span></div>
        <div className="flex justify-between text-sm"><span className="text-surface-500">TVA ({facture.taux_tva}%)</span><span>{Number(facture.montant_tva).toLocaleString('fr-FR')} €</span></div>
        <div className="flex justify-between text-base font-semibold pt-1 border-t"><span>Total TTC</span><span>{Number(facture.montant_ttc).toLocaleString('fr-FR')} €</span></div>
        {Number(facture.montant_paye) > 0 && (
          <div className="flex justify-between text-sm text-success-600"><span>Payé</span><span>-{Number(facture.montant_paye).toLocaleString('fr-FR')} €</span></div>
        )}
        {Number(facture.montant_restant) > 0 && (
          <div className="flex justify-between text-base font-semibold text-danger-600 pt-1 border-t"><span>Reste dû</span><span>{Number(facture.montant_restant).toLocaleString('fr-FR')} €</span></div>
        )}
      </div>

      {/* Paiements */}
      {(facture.paiements || []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-800 mb-2">Paiements reçus</h3>
          <div className="space-y-1.5">
            {(facture.paiements || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-50">
                <div className="flex items-center gap-2">
                  <Badge variant={PAIEMENT_STATUS_COLORS[p.status]}>{PAIEMENT_STATUS_LABELS[p.status]}</Badge>
                  <span className="text-sm text-surface-700">{PAIEMENT_MODE_LABELS[p.mode]}</span>
                  {p.reference && <span className="text-xs text-surface-400">(Réf: {p.reference})</span>}
                </div>
                <div className="text-sm font-medium text-surface-800">{Number(p.montant).toLocaleString('fr-FR')} €</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record payment button */}
      {['emise', 'envoyee', 'payee_partiellement', 'en_retard'].includes(facture.status) && Number(facture.montant_restant) > 0 && (
        <div className="flex justify-end pt-2">
          <Button onClick={onRecordPayment} icon={<CreditCard className="h-4 w-4" />}>Enregistrer un paiement</Button>
        </div>
      )}
    </div>
  )
}

// ---- Paiement Form ----

function PaiementForm({ facture, onDone }: { facture: Facture; onDone: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const modeOptions = Object.entries(PAIEMENT_MODE_LABELS).map(([v, l]) => ({ value: v, label: l }))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.set('facture_id', facture.id)
    const result = await createPaiementAction(fd)
    if (result.success) { toast('success', 'Paiement enregistré'); onDone() }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl bg-surface-50">
        <div className="flex justify-between text-sm">
          <span className="text-surface-500">Montant TTC</span>
          <span className="font-medium">{Number(facture.montant_ttc).toLocaleString('fr-FR')} €</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-surface-500">Reste dû</span>
          <span className="font-medium text-danger-600">{Number(facture.montant_restant).toLocaleString('fr-FR')} €</span>
        </div>
      </div>

      <Input id="montant" name="montant" type="number" label="Montant du paiement (€) *"
        defaultValue={String(facture.montant_restant)} error={errors.montant?.[0]} />
      <div className="grid grid-cols-2 gap-3">
        <Select id="mode" name="mode" label="Mode de paiement *" options={modeOptions} defaultValue="virement" error={errors.mode?.[0]} />
        <Input id="date_paiement" name="date_paiement" type="date" label="Date *"
          defaultValue={new Date().toISOString().split('T')[0]} error={errors.date_paiement?.[0]} />
      </div>
      <Input id="reference" name="reference" label="Référence" placeholder="N° de virement, chèque..." />
      <Input id="payeur_nom" name="payeur_nom" label="Payeur (si différent du client)" placeholder="Nom OPCO, France Travail..." />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<CreditCard className="h-4 w-4" />}>Enregistrer le paiement</Button>
      </div>
    </form>
  )
}

// ════════════════════════════════════════════════════════════
// CESSION FORM (affacturage)
// ════════════════════════════════════════════════════════════
function CessionForm({
  facture,
  affactureurs,
  onDone,
}: {
  facture: Facture
  affactureurs: { id: string; raison_sociale: string; taux_commission_default: number; taux_retenue_default: number }[]
  onDone: () => void
}) {
  const { toast } = useToast()
  const [factorId, setFactorId] = useState(affactureurs[0]?.id || '')
  const factor = affactureurs.find((a) => a.id === factorId)
  const [montantCede, setMontantCede] = useState(String(facture.montant_ttc))
  const [tauxCommission, setTauxCommission] = useState(String(factor?.taux_commission_default ?? 1.5))
  const [tauxRetenue, setTauxRetenue] = useState(String(factor?.taux_retenue_default ?? 10))
  const [referenceFactor, setReferenceFactor] = useState('')
  const [dateCession, setDateCession] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Recalcule quand factor change
  const handleFactorChange = (id: string) => {
    setFactorId(id)
    const f = affactureurs.find((a) => a.id === id)
    if (f) {
      setTauxCommission(String(f.taux_commission_default))
      setTauxRetenue(String(f.taux_retenue_default))
    }
  }

  const cede = parseFloat(montantCede) || 0
  const com = (cede * (parseFloat(tauxCommission) || 0)) / 100
  const ret = (cede * (parseFloat(tauxRetenue) || 0)) / 100
  const avance = Math.max(0, cede - com - ret)

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId) return toast('error', 'Sélectionnez un affactureur')
    setIsLoading(true)
    const fd = new FormData()
    fd.set('affactureur_id', factorId)
    fd.set('montant_cede', String(cede))
    fd.set('taux_commission', tauxCommission)
    fd.set('taux_retenue', tauxRetenue)
    fd.set('reference_factor', referenceFactor)
    fd.set('date_cession', dateCession)
    fd.set('notes', notes)
    const r = await cederFactureAction(facture.id, fd)
    setIsLoading(false)
    if (r.success) {
      toast('success', 'Facture cédée à l\'affacturage')
      onDone()
    } else {
      toast('error', r.error || 'Erreur')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
        <Banknote className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          La facture sera cédée au factor. Vous recevrez l'avance sous quelques jours.
          La cession sera soldée automatiquement quand l'OPCO paiera la facture.
        </div>
      </div>

      <Select
        id="affactureur_id"
        name="affactureur_id"
        label="Affactureur *"
        options={affactureurs.map((a) => ({ value: a.id, label: a.raison_sociale }))}
        value={factorId}
        onChange={(e) => handleFactorChange(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="montant_cede"
          name="montant_cede"
          label="Montant cédé (TTC) *"
          type="number"
          step="0.01"
          value={montantCede}
          onChange={(e) => setMontantCede(e.target.value)}
        />
        <Input
          id="date_cession"
          name="date_cession"
          label="Date de cession"
          type="date"
          value={dateCession}
          onChange={(e) => setDateCession(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="taux_commission"
          name="taux_commission"
          label="Commission (%)"
          type="number"
          step="0.01"
          value={tauxCommission}
          onChange={(e) => setTauxCommission(e.target.value)}
        />
        <Input
          id="taux_retenue"
          name="taux_retenue"
          label="Retenue garantie (%)"
          type="number"
          step="0.01"
          value={tauxRetenue}
          onChange={(e) => setTauxRetenue(e.target.value)}
        />
      </div>

      {/* Récap */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-50 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">Commission</div>
          <div className="text-sm font-bold text-rose-600 mt-0.5 tabular-nums">- {fmt(com)}</div>
        </div>
        <div className="bg-surface-50 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">Retenue</div>
          <div className="text-sm font-bold text-surface-600 mt-0.5 tabular-nums">- {fmt(ret)}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Avance</div>
          <div className="text-sm font-bold text-emerald-700 mt-0.5 tabular-nums">{fmt(avance)}</div>
        </div>
      </div>

      <Input
        id="reference_factor"
        name="reference_factor"
        label="Référence factor (optionnel)"
        placeholder="Numéro de cession côté affactureur"
        value={referenceFactor}
        onChange={(e) => setReferenceFactor(e.target.value)}
      />

      <div>
        <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-base w-full mt-1 text-sm resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Banknote className="h-4 w-4" />}>Confirmer la cession</Button>
      </div>
    </form>
  )
}
