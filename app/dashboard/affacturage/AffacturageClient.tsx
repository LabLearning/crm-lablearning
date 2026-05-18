'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Banknote, Building2, Plus, CheckCircle2, AlertCircle, Clock,
  XCircle, Trash2, Edit3, ExternalLink, Search, Filter, Wallet,
  TrendingUp, Loader2, X, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  marquerAvanceRecueAction,
  marquerSoldeeAction,
  marquerImpayeeAction,
  annulerCessionAction,
  createAffactureurAction,
  updateAffactureurAction,
  deleteAffactureurAction,
} from './actions'

type CessionStatus = 'en_attente_avance' | 'avancee' | 'soldee' | 'impayee' | 'annulee'

interface Affactureur {
  id: string
  raison_sociale: string
  siret: string | null
  contact_nom: string | null
  contact_email: string | null
  contact_telephone: string | null
  taux_commission_default: number
  taux_retenue_default: number
  delai_avance_jours: number
  plafond_encours: number | null
  notes: string | null
  is_active: boolean
}

interface Cession {
  id: string
  reference: string | null
  reference_factor: string | null
  montant_cede: number
  taux_commission: number
  montant_commission: number
  taux_retenue: number
  montant_retenue: number
  montant_avance: number
  date_cession: string
  date_avance: string | null
  date_soldee: string | null
  status: CessionStatus
  notes: string | null
  created_at: string
  facture: { id: string; numero: string; montant_ttc: number; status: string; client: { raison_sociale: string } | null } | null
  affactureur: { id: string; raison_sociale: string } | null
}

interface Props {
  cessions: Cession[]
  affactureurs: Affactureur[]
}

const STATUS_META: Record<CessionStatus, { label: string; bg: string; text: string; icon: any }> = {
  en_attente_avance: { label: 'En attente avance', bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  avancee: { label: 'Avance reçue', bg: 'bg-blue-50', text: 'text-blue-700', icon: Wallet },
  soldee: { label: 'Soldée', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  impayee: { label: 'Impayée', bg: 'bg-rose-50', text: 'text-rose-700', icon: AlertCircle },
  annulee: { label: 'Annulée', bg: 'bg-surface-100', text: 'text-surface-500', icon: XCircle },
}

function fmtEuro(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n))
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AffacturageClient({ cessions, affactureurs }: Props) {
  const [tab, setTab] = useState<'cessions' | 'affactureurs'>('cessions')
  const [filterStatus, setFilterStatus] = useState<CessionStatus | 'all' | 'actives'>('actives')
  const [filterFactor, setFilterFactor] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [editingFactor, setEditingFactor] = useState<Affactureur | null>(null)
  const [creatingFactor, setCreatingFactor] = useState(false)

  // KPIs
  const kpis = useMemo(() => {
    const enAttente = cessions.filter((c) => c.status === 'en_attente_avance')
    const avancees = cessions.filter((c) => c.status === 'avancee')
    const soldees = cessions.filter((c) => c.status === 'soldee')
    const impayees = cessions.filter((c) => c.status === 'impayee')

    const encours = [...enAttente, ...avancees].reduce((s, c) => s + Number(c.montant_cede || 0), 0)
    const totalAvances = [...avancees, ...soldees].reduce((s, c) => s + Number(c.montant_avance || 0), 0)

    // Avances ce mois
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const avancesMois = [...avancees, ...soldees]
      .filter((c) => c.date_avance && new Date(c.date_avance) >= monthStart)
      .reduce((s, c) => s + Number(c.montant_avance || 0), 0)

    return {
      encours,
      enAttenteCount: enAttente.length,
      avancees: avancees.length,
      totalAvances,
      avancesMois,
      impayeesCount: impayees.length,
      impayeesMontant: impayees.reduce((s, c) => s + Number(c.montant_cede || 0), 0),
    }
  }, [cessions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cessions.filter((c) => {
      if (filterStatus === 'actives') {
        if (c.status !== 'en_attente_avance' && c.status !== 'avancee') return false
      } else if (filterStatus !== 'all' && c.status !== filterStatus) return false
      if (filterFactor !== 'all' && c.affactureur?.id !== filterFactor) return false
      if (q) {
        const hay = `${c.facture?.numero || ''} ${c.facture?.client?.raison_sociale || ''} ${c.affactureur?.raison_sociale || ''} ${c.reference_factor || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [cessions, filterStatus, filterFactor, query])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Affacturage</h1>
          <p className="text-surface-500 text-sm mt-1">
            Cession de créances pour avance de trésorerie.
          </p>
        </div>
        {tab === 'affactureurs' && (
          <button onClick={() => setCreatingFactor(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouvel affactureur
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Banknote}
          tint="amber"
          label="Encours factor"
          value={fmtEuro(kpis.encours)}
          sub={`${kpis.enAttenteCount + kpis.avancees} cession${kpis.enAttenteCount + kpis.avancees > 1 ? 's' : ''} active${kpis.enAttenteCount + kpis.avancees > 1 ? 's' : ''}`}
        />
        <KpiCard
          icon={Wallet}
          tint="blue"
          label="Avances ce mois"
          value={fmtEuro(kpis.avancesMois)}
          sub="Cash débloqué"
        />
        <KpiCard
          icon={TrendingUp}
          tint="emerald"
          label="Total avances reçues"
          value={fmtEuro(kpis.totalAvances)}
          sub="Cumul depuis le départ"
        />
        <KpiCard
          icon={AlertCircle}
          tint="rose"
          label="Impayés"
          value={fmtEuro(kpis.impayeesMontant)}
          sub={`${kpis.impayeesCount} cession${kpis.impayeesCount > 1 ? 's' : ''}`}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-200">
        {([
          { id: 'cessions' as const, label: 'Cessions', icon: Banknote, count: cessions.length },
          { id: 'affactureurs' as const, label: 'Affactureurs', icon: Building2, count: affactureurs.length },
        ]).map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all -mb-px border-b-2',
                active
                  ? 'text-surface-900 border-surface-900'
                  : 'text-surface-500 border-transparent hover:text-surface-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className={cn(
                'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md',
                active ? 'bg-surface-900 text-white' : 'bg-surface-100 text-surface-500',
              )}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'cessions' && (
        <>
          {/* Filters */}
          <div className="card p-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="N° facture, client, factor…"
                className="input-base pl-9 w-full text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="input-base text-sm"
            >
              <option value="actives">En cours (attente + avancée)</option>
              <option value="all">Tous les statuts</option>
              <option value="en_attente_avance">En attente avance</option>
              <option value="avancee">Avance reçue</option>
              <option value="soldee">Soldée</option>
              <option value="impayee">Impayée</option>
              <option value="annulee">Annulée</option>
            </select>
            {affactureurs.length > 1 && (
              <select
                value={filterFactor}
                onChange={(e) => setFilterFactor(e.target.value)}
                className="input-base text-sm"
              >
                <option value="all">Tous les affactureurs</option>
                {affactureurs.map((a) => (
                  <option key={a.id} value={a.id}>{a.raison_sociale}</option>
                ))}
              </select>
            )}
          </div>

          {/* Cessions table */}
          {filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
              <Banknote className="h-6 w-6 text-surface-400 mb-3" />
              <p className="text-sm text-surface-500">Aucune cession à afficher</p>
              <p className="text-xs text-surface-400 mt-1">
                Cédez une facture depuis la fiche facture pour démarrer.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-surface-50/60 border-b border-surface-200">
                  <tr className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
                    <th className="px-4 py-3 text-left">Facture</th>
                    <th className="px-4 py-3 text-left">Affactureur</th>
                    <th className="px-4 py-3 text-right">Cédé</th>
                    <th className="px-4 py-3 text-right">Avance</th>
                    <th className="px-4 py-3 text-left">Cession</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CessionRow key={c.id} cession={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'affactureurs' && (
        <AffactureurList
          affactureurs={affactureurs}
          cessions={cessions}
          onEdit={(a) => setEditingFactor(a)}
        />
      )}

      {/* Modal create/edit factor */}
      {(creatingFactor || editingFactor) && (
        <AffactureurModal
          factor={editingFactor}
          onClose={() => {
            setCreatingFactor(false)
            setEditingFactor(null)
          }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════
function KpiCard({
  icon: Icon, tint, label, value, sub,
}: { icon: any; tint: 'amber' | 'blue' | 'emerald' | 'rose'; label: string; value: string; sub: string }) {
  const tints: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', tints[tint])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-surface-500">{label}</div>
          <div className="text-xl font-heading font-bold text-surface-900 truncate">{value}</div>
        </div>
      </div>
      <div className="text-[11px] text-surface-400 mt-2 tabular-nums">{sub}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// CESSION ROW
// ════════════════════════════════════════════════════════════
function CessionRow({ cession }: { cession: Cession }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState(false)
  const meta = STATUS_META[cession.status]
  const Icon = meta.icon

  const doAction = async (action: () => Promise<{ success: boolean; error?: string }>) => {
    setPending(true)
    startTransition(async () => {
      const r = await action()
      setPending(false)
      if (!r.success) alert(r.error || 'Erreur')
      else router.refresh()
    })
  }

  const canAvance = cession.status === 'en_attente_avance'
  const canSolde = cession.status === 'avancee'
  const canImpayee = cession.status === 'avancee'
  const canAnnuler = cession.status === 'en_attente_avance'

  return (
    <tr className="border-b border-surface-100 last:border-0 hover:bg-surface-50/40 transition-colors">
      <td className="px-4 py-3">
        {cession.facture ? (
          <Link href={`/dashboard/factures/${cession.facture.id}`}
            className="text-sm font-medium text-surface-900 hover:text-brand-600 inline-flex items-center gap-1">
            {cession.facture.numero || 'Brouillon'}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
        ) : <span className="text-sm text-surface-400">—</span>}
        {cession.facture?.client && (
          <div className="text-xs text-surface-500 truncate max-w-[180px]">{cession.facture.client.raison_sociale}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-surface-800">
        {cession.affactureur?.raison_sociale || '—'}
        {cession.reference_factor && (
          <div className="text-xs text-surface-400 font-mono">{cession.reference_factor}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium text-surface-900 tabular-nums">
        {fmtEuro(cession.montant_cede)}
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">
        <div className="font-bold text-emerald-700">{fmtEuro(cession.montant_avance)}</div>
        <div className="text-[10px] text-surface-400">
          comm. {cession.taux_commission}% · ret. {cession.taux_retenue}%
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-surface-700">
        {fmtDate(cession.date_cession)}
        {cession.date_avance && (
          <div className="text-[11px] text-surface-400">Avance : {fmtDate(cession.date_avance)}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold', meta.bg, meta.text)}>
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          {canAvance && (
            <button
              onClick={() => doAction(() => marquerAvanceRecueAction(cession.id, new Date().toISOString().split('T')[0]))}
              disabled={pending}
              className="text-[11px] font-semibold px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Avance reçue
            </button>
          )}
          {canSolde && (
            <button
              onClick={() => doAction(() => marquerSoldeeAction(cession.id))}
              disabled={pending}
              className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Soldée
            </button>
          )}
          {canImpayee && (
            <button
              onClick={() => {
                if (confirm('Marquer comme impayée par l\'OPCO ? Le factor pourrait exercer un recours.')) {
                  doAction(() => marquerImpayeeAction(cession.id))
                }
              }}
              disabled={pending}
              className="text-[11px] font-semibold px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100"
            >
              Impayée
            </button>
          )}
          {canAnnuler && (
            <button
              onClick={() => {
                if (confirm('Annuler cette cession ?')) doAction(() => annulerCessionAction(cession.id))
              }}
              disabled={pending}
              className="text-surface-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-surface-100"
              title="Annuler"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ════════════════════════════════════════════════════════════
// AFFACTUREURS LIST
// ════════════════════════════════════════════════════════════
function AffactureurList({
  affactureurs, cessions, onEdit,
}: { affactureurs: Affactureur[]; cessions: Cession[]; onEdit: (a: Affactureur) => void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  if (affactureurs.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
        <Building2 className="h-6 w-6 text-surface-400 mb-3" />
        <p className="text-sm text-surface-500">Aucun affactureur enregistré</p>
        <p className="text-xs text-surface-400 mt-1">Ajoutez votre partenaire factor pour pouvoir céder des factures.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {affactureurs.map((a) => {
        const activeCessions = cessions.filter(
          (c) => c.affactureur?.id === a.id && ['en_attente_avance', 'avancee'].includes(c.status),
        )
        const encours = activeCessions.reduce((s, c) => s + Number(c.montant_cede || 0), 0)
        const plafondPct = a.plafond_encours && a.plafond_encours > 0
          ? Math.min(100, Math.round((encours / a.plafond_encours) * 100))
          : null

        return (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-surface-900 truncate">{a.raison_sociale}</h3>
                  {!a.is_active && (
                    <span className="text-[10px] bg-surface-200 text-surface-600 px-1.5 py-0.5 rounded">Archivé</span>
                  )}
                </div>
                {a.siret && <div className="text-xs text-surface-400 font-mono mt-0.5">SIRET {a.siret}</div>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(a)}
                  className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-100"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer définitivement « ${a.raison_sociale} » ?`)) {
                      startTransition(async () => {
                        const { deleteAffactureurAction } = await import('./actions')
                        const r = await deleteAffactureurAction(a.id)
                        if (!r.success) alert(r.error || 'Erreur')
                        else router.refresh()
                      })
                    }
                  }}
                  className="p-1.5 rounded-md text-surface-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-surface-50 rounded-lg p-2">
                <div className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">Commission</div>
                <div className="font-bold text-surface-900 mt-0.5">{a.taux_commission_default}%</div>
              </div>
              <div className="bg-surface-50 rounded-lg p-2">
                <div className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">Retenue</div>
                <div className="font-bold text-surface-900 mt-0.5">{a.taux_retenue_default}%</div>
              </div>
            </div>

            {a.plafond_encours && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-surface-500">
                  <span>Encours / Plafond</span>
                  <span className="tabular-nums">{fmtEuro(encours)} / {fmtEuro(a.plafond_encours)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      (plafondPct || 0) >= 90 ? 'bg-rose-500' : (plafondPct || 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
                    )}
                    style={{ width: `${plafondPct}%` }}
                  />
                </div>
              </div>
            )}

            {(a.contact_email || a.contact_telephone) && (
              <div className="mt-3 pt-3 border-t border-surface-100 text-xs text-surface-500 space-y-0.5">
                {a.contact_nom && <div className="font-medium text-surface-700">{a.contact_nom}</div>}
                {a.contact_email && <div>{a.contact_email}</div>}
                {a.contact_telephone && <div>{a.contact_telephone}</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// AFFACTUREUR MODAL
// ════════════════════════════════════════════════════════════
function AffactureurModal({ factor, onClose }: { factor: Affactureur | null; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!factor

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const r = isEdit
        ? await updateAffactureurAction(factor!.id, fd)
        : await createAffactureurAction(fd)
      if (r.success) {
        router.refresh()
        onClose()
      } else setError(r.error || 'Erreur')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-modal max-h-[95vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between shrink-0">
          <div className="text-base font-heading font-semibold text-surface-900">
            {isEdit ? 'Modifier l\'affactureur' : 'Nouvel affactureur'}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-4">
            <Field label="Raison sociale *" name="raison_sociale" defaultValue={factor?.raison_sociale || ''} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="SIRET" name="siret" defaultValue={factor?.siret || ''} />
              <Field label="Délai avance (jours)" name="delai_avance_jours" type="number" defaultValue={String(factor?.delai_avance_jours ?? 2)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Commission %" name="taux_commission_default" type="number" step="0.01" defaultValue={String(factor?.taux_commission_default ?? 1.5)} />
              <Field label="Retenue %" name="taux_retenue_default" type="number" step="0.01" defaultValue={String(factor?.taux_retenue_default ?? 10)} />
            </div>

            <Field label="Plafond d'encours (€)" name="plafond_encours" type="number" defaultValue={factor?.plafond_encours ? String(factor.plafond_encours) : ''} />

            <div className="pt-2 border-t border-surface-200">
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Contact</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom contact" name="contact_nom" defaultValue={factor?.contact_nom || ''} />
                <Field label="Téléphone" name="contact_telephone" defaultValue={factor?.contact_telephone || ''} />
              </div>
              <div className="mt-3">
                <Field label="Email" name="contact_email" type="email" defaultValue={factor?.contact_email || ''} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Notes</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={factor?.notes || ''}
                className="input-base w-full mt-1 text-sm resize-none"
              />
            </div>

            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>

          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-end gap-2 bg-surface-50/60">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-white">
              Annuler
            </button>
            <button type="submit" disabled={isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, ...inputProps }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">{label}</label>
      <input {...inputProps} className="input-base w-full mt-1 text-sm" />
    </div>
  )
}
