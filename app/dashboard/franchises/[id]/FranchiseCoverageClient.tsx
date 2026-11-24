'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Network, Pencil, Check, Loader2, X } from '@/components/ui/icons'
import { updateFranchiseAction } from '../actions'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

/**
 * Couverture du réseau et potentiel restant, en une carte : combien
 * d'établissements restent à former et ce qu'ils représentent au rythme des
 * établissements déjà formés.
 */
export default function FranchiseCoverageClient({
  franchiseId, totalDeclares, nbFormes, nbRattaches, pecTotal, commTotal,
}: {
  franchiseId: string
  totalDeclares: number
  nbFormes: number
  nbRattaches: number
  pecTotal: number
  /** Commissions de toutes les sessions (à venir, à verser, versées) */
  commTotal: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(totalDeclares || ''))
  const [saving, setSaving] = useState(false)

  const total = totalDeclares
  const restants = Math.max(0, total - nbFormes)
  const pct = total > 0 ? Math.min(100, Math.round((nbFormes / total) * 100)) : 0
  const pecMoyen = nbFormes > 0 ? pecTotal / nbFormes : 0
  const commMoyenne = nbFormes > 0 ? commTotal / nbFormes : 0

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
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-surface-400" />
          <h2 className="text-sm font-heading font-semibold text-surface-900">Couverture du réseau</h2>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
            <Pencil className="h-3.5 w-3.5" /> {total > 0 ? 'Modifier le nombre d’établissements du réseau' : 'Indiquer le nombre d’établissements du réseau'}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 bg-surface-50 rounded-xl p-3">
          <div className="w-56">
            <label htmlFor="total-reseau" className="text-xs font-semibold text-surface-600">Établissements du réseau (total)</label>
            <input id="total-reseau" type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} placeholder="ex : 143" className="input-base w-full mt-1 text-sm" autoFocus />
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
          </button>
          <button type="button" onClick={() => { setEditing(false); setVal(String(totalDeclares || '')) }} aria-label="Annuler"
            className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-600 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {total === 0 ? (
        <p className="mt-3 text-sm text-surface-500">
          {nbFormes} établissement{nbFormes > 1 ? 's' : ''} formé{nbFormes > 1 ? 's' : ''} sur {nbRattaches} rattaché{nbRattaches > 1 ? 's' : ''}.
          Indiquez le nombre total d’établissements du réseau pour voir ce qu’il reste à former.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-surface-600">
                <span className="font-heading font-bold text-surface-900 tabular-nums">{nbFormes}</span> formés sur <span className="tabular-nums">{total}</span>
              </span>
              <span className="text-xs text-surface-500 tabular-nums">{pct} %</span>
            </div>
            <div className="mt-2 h-2 bg-surface-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-surface-500">
              {restants > 0 ? `${restants} établissement${restants > 1 ? 's' : ''} à former` : 'Tout le réseau est formé'}
              {nbRattaches !== nbFormes && ` · ${nbRattaches} rattaché${nbRattaches > 1 ? 's' : ''} dans le CRM`}
            </p>
          </div>
          {restants > 0 && nbFormes > 0 && (
            <div className="rounded-xl bg-surface-50 p-3">
              <div className="text-[11px] font-semibold text-surface-500">Potentiel des {restants} établissements à former</div>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-base font-heading font-bold text-surface-900 tabular-nums">{fmtEuro(restants * pecMoyen)}</div>
                  <div className="text-[11px] text-surface-500">de prise en charge (~{fmtEuro(pecMoyen)} par établissement)</div>
                </div>
                <div>
                  <div className="text-base font-heading font-bold text-surface-900 tabular-nums">{fmtEuro(restants * commMoyenne)}</div>
                  <div className="text-[11px] text-surface-500">de commission TTC (~{fmtEuro(commMoyenne)} par établissement)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
