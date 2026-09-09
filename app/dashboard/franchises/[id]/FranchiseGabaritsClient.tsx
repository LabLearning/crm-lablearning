'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { Eye, Loader2, Upload, XCircle, FileText } from '@/components/ui/icons'
import {
  uploadGabaritFranchiseAction, retirerGabaritFranchiseAction, setPmsPersonnalisableAction, lienGabaritAction, type GabaritType,
} from '../gabarits-actions'

interface Props {
  franchiseId: string
  gabarits: { pms: string | null; affichages: string | null; livret: string | null }
  pmsPersonnalisable: boolean
}

const TYPES: { id: GabaritType; titre: string; aide: string }[] = [
  { id: 'pms', titre: 'Plan de maîtrise sanitaire', aide: 'Version co-brandée au logo de la franchise (gabarit Lab Learning), ou PMS propre à l’enseigne' },
  { id: 'affichages', titre: 'Affichages obligatoires', aide: 'Allergènes, lavage des mains, tenue, origine des viandes, aux couleurs de l’enseigne' },
  { id: 'livret', titre: 'Livret d’accueil', aide: 'Livret d’accueil de l’enseigne, remis aux stagiaires' },
]

/** Gabarits du Pack Hygiène propres à la franchise ; à défaut, ceux de l'organisme s'appliquent. */
export function FranchiseGabaritsClient({ franchiseId, gabarits, pmsPersonnalisable }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function deposer(type: GabaritType, file: File) {
    setBusy(type)
    const fd = new FormData()
    fd.append('fichier', file)
    const r = await uploadGabaritFranchiseAction(franchiseId, type, fd)
    setBusy(null)
    if (r.success) { toast('success', 'Gabarit enregistré'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }
  async function retirer(type: GabaritType) {
    if (!confirm('Retirer ce gabarit ? La franchise utilisera celui de l’organisme.')) return
    setBusy(type)
    const r = await retirerGabaritFranchiseAction(franchiseId, type)
    setBusy(null)
    if (r.success) { toast('success', 'Gabarit retiré'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }
  async function ouvrir(type: GabaritType) {
    const r = await lienGabaritAction(franchiseId, type)
    if (r.success && r.url) window.open(r.url, '_blank', 'noopener')
    else toast('error', r.error || 'Lien indisponible')
  }
  async function basculerPersonnalisable(v: boolean) {
    setBusy('perso')
    const r = await setPmsPersonnalisableAction(franchiseId, v)
    setBusy(null)
    if (r.success) router.refresh()
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100">
        <h3 className="text-sm font-heading font-semibold text-surface-900">Pack Hygiène : gabarits de l’enseigne</h3>
        <p className="text-xs text-surface-500 mt-0.5">
          Utilisés pour toutes les sessions hygiène des établissements de la franchise. Sans gabarit, les documents Lab Learning s’appliquent.
        </p>
      </div>
      <div className="divide-y divide-surface-100">
        {TYPES.map((t) => {
          const present = !!gabarits[t.id]
          return (
            <div key={t.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-brand-600" /></span>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-semibold text-surface-900">{t.titre}</div>
                  <div className="text-xs text-surface-500">{t.aide}</div>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${present ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                  {present ? 'Gabarit de l’enseigne' : 'Gabarit Lab Learning'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {present && (
                    <button onClick={() => ouvrir(t.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50">
                      <Eye className="h-3.5 w-3.5" /> Voir
                    </button>
                  )}
                  <input ref={(el) => { inputs.current[t.id] = el }} type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) deposer(t.id, f); e.target.value = '' }} />
                  <button onClick={() => inputs.current[t.id]?.click()} disabled={busy === t.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-40">
                    {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {present ? 'Remplacer' : 'Déposer un PDF'}
                  </button>
                  {present && (
                    <button onClick={() => retirer(t.id)} disabled={busy === t.id} title="Retirer le gabarit"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-danger-200 text-danger-600 text-xs font-medium hover:bg-danger-50 disabled:opacity-40">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {t.id === 'pms' && present && (
                <label className="mt-2 ml-12 flex items-start gap-2 text-xs text-surface-600 cursor-pointer">
                  <input type="checkbox" checked={pmsPersonnalisable} disabled={busy === 'perso'}
                    onChange={(e) => basculerPersonnalisable(e.target.checked)} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-surface-800">Gabarit Lab Learning co-brandé</span> : le CRM remplit la couverture, l’engagement du responsable, les informations de l’établissement et le plan de formation du personnel.
                    Décochez si c’est le PMS propre à l’enseigne (joint tel quel).
                  </span>
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
