'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, X, Loader2, Check, UserPlus, UserMinus, Repeat } from 'lucide-react'
import { declareParticipantChangeAction } from './actions'

interface Participant { apprenant_id: string; nom: string }

export function DeclareChangeButton({
  token, sessionId, participants,
}: { token: string; sessionId: string; participants: Participant[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'ajout' | 'retrait' | 'remplacement'>('remplacement')
  const [apprenantId, setApprenantId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const needsExisting = type === 'retrait' || type === 'remplacement'
  const needsNew = type === 'ajout' || type === 'remplacement'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('session_id', sessionId)
    fd.set('type', type)
    if (needsExisting) fd.set('apprenant_id', apprenantId)
    setError(null)
    startTransition(async () => {
      const r = await declareParticipantChangeAction(token, fd)
      if (r.success) {
        setDone(true)
        router.refresh()
        setTimeout(() => { setOpen(false); setDone(false); setApprenantId('') }, 1600)
      } else setError(r.error || 'Erreur')
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
      >
        <UserCog className="h-3.5 w-3.5" /> Déclarer un changement
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-modal max-h-[95vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between shrink-0">
              <div className="text-base font-heading font-semibold text-surface-900">Changement de participant</div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100"><X className="h-4 w-4" /></button>
            </div>

            {done ? (
              <div className="p-8 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-surface-900">Demande envoyée</p>
                <p className="text-xs text-surface-500 mt-1">Le gestionnaire va la valider.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="px-5 py-5 space-y-4">
                  {/* Type */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { v: 'remplacement', label: 'Remplacer', icon: Repeat },
                      { v: 'ajout', label: 'Ajouter', icon: UserPlus },
                      { v: 'retrait', label: 'Retirer', icon: UserMinus },
                    ] as const).map((o) => {
                      const Icon = o.icon
                      const active = type === o.v
                      return (
                        <button key={o.v} type="button" onClick={() => setType(o.v)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${active ? 'border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                          <Icon className="h-4 w-4" /> {o.label}
                        </button>
                      )
                    })}
                  </div>

                  {needsExisting && (
                    <div>
                      <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">
                        {type === 'remplacement' ? 'Participant à remplacer' : 'Participant à retirer'}
                      </label>
                      <select value={apprenantId} onChange={(e) => setApprenantId(e.target.value)} className="input-base w-full mt-1 text-sm">
                        <option value="">Sélectionner…</option>
                        {participants.map((p) => <option key={p.apprenant_id} value={p.apprenant_id}>{p.nom}</option>)}
                      </select>
                    </div>
                  )}

                  {needsNew && (
                    <div className="space-y-2 rounded-xl border border-surface-200 p-3 bg-surface-50/40">
                      <div className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Nouveau participant</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="nouveau_prenom" placeholder="Prénom" className="input-base text-sm" />
                        <input name="nouveau_nom" placeholder="Nom *" className="input-base text-sm" />
                      </div>
                      <input name="nouveau_email" type="email" placeholder="Email (optionnel)" className="input-base text-sm w-full" />
                      <input name="nouveau_telephone" placeholder="Téléphone (optionnel)" className="input-base text-sm w-full" />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Motif</label>
                    <textarea name="motif" rows={2} placeholder="Ex : absent le jour J, remplacé par un collègue…" className="input-base w-full mt-1 text-sm resize-none" />
                  </div>

                  {error && <div className="text-xs text-rose-600">{error}</div>}
                </div>

                <div className="px-5 py-3 border-t border-surface-200 flex items-center justify-end gap-2 bg-surface-50/60">
                  <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-white">Annuler</button>
                  <button type="submit" disabled={isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer la demande
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
