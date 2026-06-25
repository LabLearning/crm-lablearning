'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Network, Pencil, Check, Loader2, Building2, TrendingUp, Banknote, X } from 'lucide-react'
import { ProgressRing } from '@/components/ui'
import { updateFranchiseAction } from '../actions'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default function FranchiseCoverageClient({
  franchiseId, totalDeclares, nbFormes, nbRattaches, caTotal, pecTotal, commTotal, taux,
}: {
  franchiseId: string
  totalDeclares: number
  nbFormes: number
  nbRattaches: number
  caTotal: number
  pecTotal: number
  commTotal: number
  taux: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(totalDeclares || ''))
  const [saving, setSaving] = useState(false)

  const total = totalDeclares
  const restants = Math.max(0, total - nbFormes)
  const pct = total > 0 ? Math.round((nbFormes / total) * 100) : null

  const pecMoyen = nbFormes > 0 ? pecTotal / nbFormes : 0
  const caMoyen = nbFormes > 0 ? caTotal / nbFormes : 0
  const caPotentiel = restants * caMoyen
  const pecPotentiel = restants * pecMoyen
  const commPotentielle = pecPotentiel * (taux / 100)

  const save = () => {
    setSaving(true)
    const fd = new FormData()
    fd.set('nombre_etablissements', val)
    startTransition(async () => {
      const r = await updateFranchiseAction(franchiseId, fd)
      setSaving(false)
      if (r.success) { setEditing(false); router.refresh() }
      else alert((r as any).error || 'Erreur')
    })
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-surface-400" />
          <h2 className="text-sm font-heading font-semibold text-surface-900">Couverture du réseau & prévisionnel</h2>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
            <Pencil className="h-3.5 w-3.5" /> {total > 0 ? 'Modifier le total' : 'Définir le total'}
          </button>
        )}
      </div>

      {/* Edition du total déclaré */}
      {editing && (
        <div className="mb-4 flex items-end gap-2 bg-surface-50 rounded-xl p-3">
          <div className="flex-1 max-w-[220px]">
            <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Nombre total d'établissements du réseau</label>
            <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} placeholder="ex : 143" className="input-base w-full mt-1 text-sm" autoFocus />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
          </button>
          <button onClick={() => { setEditing(false); setVal(String(totalDeclares || '')) }} className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-600 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {total === 0 ? (
        <div className="text-center py-8">
          <Network className="h-6 w-6 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-500">Renseignez le nombre total d'établissements du réseau pour activer le taux de couverture et le prévisionnel.</p>
        </div>
      ) : (
        <>
          {/* Couverture : ring + barres */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ProgressRing value={pct || 0} size={140} stroke={13} color="#6366F1" sublabel="formé" />
            <div className="flex-1 w-full space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-surface-600">Établissements formés</span>
                  <span className="font-semibold text-surface-900 tabular-nums">{nbFormes} / {total}</span>
                </div>
                <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Pastille dot="bg-surface-300" label="Total réseau" value={total} />
                <Pastille dot="bg-brand-500" label="Formés" value={nbFormes} />
                <Pastille dot="bg-amber-400" label="À former" value={restants} />
              </div>
              {nbRattaches !== nbFormes && (
                <p className="text-[11px] text-surface-400">{nbRattaches} établissement{nbRattaches > 1 ? 's' : ''} rattaché{nbRattaches > 1 ? 's' : ''} dans le CRM ({nbFormes} avec au moins un dossier).</p>
              )}
            </div>
          </div>

          {/* Prévisionnel */}
          <div className="mt-5 pt-5 border-t border-surface-100">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Prévisionnel sur les {restants} établissements à former
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Pot icon={Building2} tint="blue" label="CA potentiel" value={fmtEuro(caPotentiel)} sub={`~${fmtEuro(caMoyen)} / étab.`} />
              <Pot icon={TrendingUp} tint="emerald" label="Prise en charge potentielle" value={fmtEuro(pecPotentiel)} sub={`~${fmtEuro(pecMoyen)} / étab.`} />
              <Pot icon={Banknote} tint="amber" label={`Commission potentielle (${taux}%)`} value={fmtEuro(commPotentielle)} sub={`actuelle : ${fmtEuro(commTotal)}`} highlight />
            </div>
            <p className="text-[11px] text-surface-400 mt-3">Estimation basée sur la moyenne par établissement déjà formé.</p>
          </div>
        </>
      )}
    </div>
  )
}

function Pastille({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="bg-surface-50 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-wider text-surface-400 font-semibold">{label}</span>
      </div>
      <div className="text-lg font-heading font-bold text-surface-900 mt-1 tabular-nums">{value}</div>
    </div>
  )
}

function Pot({ icon: Icon, tint, label, value, sub, highlight }: { icon: any; tint: string; label: string; value: string; sub: string; highlight?: boolean }) {
  const tints: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'border-amber-200 bg-amber-50/30' : 'border-surface-200/70'}`}>
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tints[tint]}`}><Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></div>
      <div className={`text-lg font-heading font-bold mt-2.5 tabular-nums ${highlight ? 'text-amber-600' : 'text-surface-900'}`}>{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
      <div className="text-[11px] text-surface-400 mt-0.5">{sub}</div>
    </div>
  )
}
