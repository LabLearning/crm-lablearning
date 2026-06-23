'use client'

import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useToast } from '@/components/ui'
import { updatePoeiStatutAction } from '../actions'
import { POEI_STATUS_LABELS, POEI_WORKFLOW } from '@/lib/types/poei'
import type { PoeiStatus } from '@/lib/types/poei'

const statusOptions = Object.entries(POEI_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function PoeiStatusBar({ poeiId, statut }: { poeiId: string; statut: PoeiStatus }) {
  const { toast } = useToast()
  const router = useRouter()

  async function change(s: string) {
    const result = await updatePoeiStatutAction(poeiId, s)
    if (result.success) { toast('success', 'Statut mis à jour'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  const currentIdx = POEI_WORKFLOW.indexOf(statut)
  const isTerminal = statut === 'refuse' || statut === 'abandonne'

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="section-label">Avancement</span>
        <select value={statut} onChange={(e) => change(e.target.value)} className="input-base h-9 w-56 text-sm">
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!isTerminal && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {POEI_WORKFLOW.map((step, i) => {
            const done = currentIdx >= 0 && i <= currentIdx
            const isCurrent = i === currentIdx
            return (
              <div key={step} className="flex items-center shrink-0">
                <button
                  onClick={() => change(step)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isCurrent ? 'bg-sky-500 text-white' : done ? 'bg-sky-50 text-sky-700' : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  {done && !isCurrent && <Check className="h-3 w-3" />}
                  {POEI_STATUS_LABELS[step]}
                </button>
                {i < POEI_WORKFLOW.length - 1 && <div className={`h-px w-3 ${done ? 'bg-sky-300' : 'bg-surface-200'}`} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
