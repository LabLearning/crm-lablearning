'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Store, Building2, Banknote, TrendingUp, ChevronRight, Plus, X, Loader2,
} from 'lucide-react'
import { commissionTypeLabel } from '@/lib/commission'
import { createFranchiseAction } from './actions'

interface Franchise {
  id: string
  nom: string
  raison_sociale: string | null
  secteur: string | null
  nombre_etablissements: number | null
  objectif_annuel_ca: number | null
  commission_type: string | null
  taux_commission: number | null
  logo_url: string | null
  is_active: boolean
}
interface Client { id: string; franchise_id: string | null }
interface Dossier { id: string; franchise_id: string | null; montant_total_ttc: number | null; commission_montant: number | null; commission_status: string | null }

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default function FranchisesClient({
  franchises, clients, dossiers,
}: { franchises: Franchise[]; clients: Client[]; dossiers: Dossier[] }) {
  const [showCreate, setShowCreate] = useState(false)

  const statsFor = (fid: string) => {
    const etabs = clients.filter((c) => c.franchise_id === fid).length
    const ds = dossiers.filter((d) => d.franchise_id === fid)
    const ca = ds.reduce((s, d) => s + Number(d.montant_total_ttc || 0), 0)
    const commAVenir = ds.filter((d) => d.commission_status === 'a_venir' || d.commission_status === 'validee')
      .reduce((s, d) => s + Number(d.commission_montant || 0), 0)
    return { etabs, dossiers: ds.length, ca, commAVenir }
  }

  const totalEtabs = clients.length
  const totalCommAVenir = dossiers.filter((d) => d.commission_status === 'a_venir' || d.commission_status === 'validee')
    .reduce((s, d) => s + Number(d.commission_montant || 0), 0)
  const totalCommPayee = dossiers.filter((d) => d.commission_status === 'payee')
    .reduce((s, d) => s + Number(d.commission_montant || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Franchises</h1>
          <p className="text-surface-500 text-sm mt-1">Réseaux franchisés, établissements formés et commissions.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nouvelle franchise
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Store} tint="brand" label="Franchises" value={String(franchises.length)} />
        <Kpi icon={Building2} tint="blue" label="Établissements" value={String(totalEtabs)} />
        <Kpi icon={Banknote} tint="amber" label="Commissions à verser" value={fmtEuro(totalCommAVenir)} />
        <Kpi icon={TrendingUp} tint="emerald" label="Commissions payées" value={fmtEuro(totalCommPayee)} />
      </div>

      {franchises.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Store className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucune franchise</p>
          <p className="text-xs text-surface-400 mt-1">Créez votre premier réseau franchisé, puis rattachez-y des établissements et un compte franchiseur.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 mt-4">
            <Plus className="h-4 w-4" /> Créer une franchise
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {franchises.map((f) => {
            const st = statsFor(f.id)
            return (
              <Link key={f.id} href={`/dashboard/franchises/${f.id}`}
                className="card p-5 hover:border-brand-300 transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {f.logo_url ? (
                        <img src={f.logo_url} alt={f.nom} className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <Store className="h-4 w-4 text-brand-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-surface-900 truncate">{f.nom}</h3>
                      {f.secteur && <div className="text-xs text-surface-500">{f.secteur}</div>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <Mini label="Établissements" value={String(st.etabs)} />
                  <Mini label="Dossiers" value={String(st.dossiers)} />
                  <Mini label="CA généré" value={fmtEuro(st.ca)} />
                </div>
                <div className="mt-3 pt-3 border-t border-surface-100 flex items-center justify-between">
                  <span className="text-xs text-surface-500 inline-flex items-center gap-1">
                    <Banknote className="h-3.5 w-3.5" /> {f.taux_commission}% · {commissionTypeLabel(f.commission_type)}
                  </span>
                  <span className="text-sm font-bold text-amber-600 tabular-nums">
                    {fmtEuro(st.commAVenir)} <span className="text-[10px] font-normal text-surface-400">à verser</span>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showCreate && <CreateFranchiseModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function Kpi({ icon: Icon, tint, label, value }: { icon: any; tint: string; label: string; value: string }) {
  const tints: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tints[tint]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-heading font-bold text-surface-900 truncate">{value}</div>
        <div className="text-xs text-surface-500">{label}</div>
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-50 rounded-lg p-2">
      <div className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">{label}</div>
      <div className="text-sm font-bold text-surface-900 mt-0.5 tabular-nums truncate">{value}</div>
    </div>
  )
}

function CreateFranchiseModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [commType, setCommType] = useState<'budget_debloque' | 'budget_net'>('budget_debloque')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('commission_type', commType)
    setError(null)
    startTransition(async () => {
      const r = await createFranchiseAction(fd)
      if (r.success) { router.refresh(); router.push(`/dashboard/franchises/${(r as any).data.id}`) }
      else setError((r as any).error || 'Erreur')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-modal max-h-[95vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between shrink-0">
          <div className="text-base font-heading font-semibold text-surface-900">Nouvelle franchise</div>
          <button onClick={onClose} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-4">
            <Field label="Nom de l'enseigne *" name="nom" required placeholder="Brioche Dorée" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Raison sociale" name="raison_sociale" />
              <Field label="SIRET" name="siret" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Secteur" name="secteur" placeholder="Boulangerie, HCR…" />
              <Field label="Nb établissements" name="nombre_etablissements" type="number" />
            </div>

            <div className="pt-2 border-t border-surface-200">
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Contact référent</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom" name="contact_nom" />
                <Field label="Téléphone" name="contact_telephone" />
              </div>
              <div className="mt-3"><Field label="Email" name="contact_email" type="email" /></div>
            </div>

            <div className="pt-2 border-t border-surface-200">
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Commission</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setCommType('budget_debloque')}
                  className={`text-left p-3 rounded-xl border transition-all ${commType === 'budget_debloque' ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200' : 'border-surface-200 hover:border-surface-300'}`}>
                  <div className="text-sm font-semibold text-surface-900">Budget débloqué</div>
                  <div className="text-xs text-surface-500 mt-0.5">% × prise en charge OPCO</div>
                </button>
                <button type="button" onClick={() => setCommType('budget_net')}
                  className={`text-left p-3 rounded-xl border transition-all ${commType === 'budget_net' ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200' : 'border-surface-200 hover:border-surface-300'}`}>
                  <div className="text-sm font-semibold text-surface-900">Budget net</div>
                  <div className="text-xs text-surface-500 mt-0.5">% × (PEC − coût formateur)</div>
                </button>
              </div>
              <div className="mt-3 max-w-[140px]">
                <Field label="Taux (%)" name="taux_commission" type="number" step="0.5" defaultValue={commType === 'budget_net' ? '40' : '10'} key={commType} />
              </div>
            </div>

            <Field label="Objectif annuel CA (€)" name="objectif_annuel_ca" type="number" />

            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>

          <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-end gap-2 bg-surface-50/60">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-white">Annuler</button>
            <button type="submit" disabled={isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Créer la franchise
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">{label}</label>
      <input {...props} className="input-base w-full mt-1 text-sm" />
    </div>
  )
}
