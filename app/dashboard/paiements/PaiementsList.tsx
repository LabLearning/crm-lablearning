'use client'

import { useState, useMemo } from 'react'
import { Search, CreditCard, Euro, Calendar, Building2 } from '@/components/ui/icons'
import { Badge } from '@/components/ui'
import { PAIEMENT_MODE_LABELS, PAIEMENT_STATUS_LABELS, PAIEMENT_STATUS_COLORS } from '@/lib/types/facture'
import { formatDate, companyLabel } from '@/lib/utils'
import type { Paiement, PaiementStatus } from '@/lib/types/facture'

interface PaiementsListProps {
  paiements: Paiement[]
  /** Total encaissé de l'organisme : l'admin seul (lib/acces-reserves) */
  voitChiffreAffaires?: boolean
}

export function PaiementsList({ paiements, voitChiffreAffaires = false }: PaiementsListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    return paiements.filter((p) => {
      const matchSearch = (p.facture?.numero || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.payeur_nom || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.facture?.client?.raison_sociale || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [paiements, search, statusFilter])

  const totalEncaisse = paiements.filter((p) => p.status === 'valide').reduce((s, p) => s + Number(p.montant), 0)
  const totalAttente = paiements.filter((p) => p.status === 'en_attente').reduce((s, p) => s + Number(p.montant), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Paiements</h1>
        <p className="text-surface-500 mt-1 text-sm">{paiements.length} paiement{paiements.length > 1 ? 's' : ''} enregistré{paiements.length > 1 ? 's' : ''}</p>
      </div>

      <div className={`grid ${voitChiffreAffaires ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-3 mb-5`}>
        {/* Le total encaissé de l'organisme est à l'admin seul (lib/acces-reserves) */}
        {voitChiffreAffaires && (
          <div className="card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-success-50/60 flex items-center justify-center"><Euro className="h-4 w-4 text-success-600" /></div>
            <div><div className="text-xs text-surface-500">Total encaissé</div><div className="text-lg font-heading font-bold text-success-600">{totalEncaisse.toLocaleString('fr-FR')} €</div></div>
          </div>
        )}
        <div className="card p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-warning-50/60 flex items-center justify-center"><CreditCard className="h-4 w-4 text-warning-600" /></div>
          <div><div className="text-xs text-surface-500">En attente</div><div className="text-lg font-heading font-bold text-warning-600">{totalAttente.toLocaleString('fr-FR')} €</div></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'valide', 'en_attente', 'refuse'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${statusFilter === s ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
              {s === 'all' ? 'Tous' : PAIEMENT_STATUS_LABELS[s as PaiementStatus]}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Facture</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Client</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Mode</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Montant</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Date</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Référence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-mono text-brand-600">{p.facture?.numero || '—'}</td>
                  <td className="px-6 py-3.5 text-sm text-surface-700">{companyLabel(p.facture?.client) || p.payeur_nom || '—'}</td>
                  <td className="px-6 py-3.5"><Badge variant="default">{PAIEMENT_MODE_LABELS[p.mode]}</Badge></td>
                  <td className="px-6 py-3.5"><Badge variant={PAIEMENT_STATUS_COLORS[p.status]} dot>{PAIEMENT_STATUS_LABELS[p.status]}</Badge></td>
                  <td className="px-6 py-3.5 text-right text-sm font-medium text-surface-800">{Number(p.montant).toLocaleString('fr-FR')} €</td>
                  <td className="px-6 py-3.5 hidden md:table-cell text-sm text-surface-500">{formatDate(p.date_paiement, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-6 py-3.5 hidden lg:table-cell text-sm text-surface-500">{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-sm text-surface-500">Aucun paiement trouvé</div>}
      </div>
    </div>
  )
}
