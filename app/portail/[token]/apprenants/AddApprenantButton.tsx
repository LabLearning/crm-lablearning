'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Loader2 } from 'lucide-react'
import { addApprenantBySessionFormateurAction } from './actions'

const CONTRAT_OPTIONS = [
  '', 'Dirigeant', 'CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', "Demandeur d'emploi", 'Autre',
]

/**
 * Bouton + fenêtre permettant au formateur d'ajouter un apprenant à SA session
 * directement depuis son espace. L'ajout est immédiat (pas un ticket).
 */
export function AddApprenantButton({ token, sessionId }: { token: string; sessionId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const r = await addApprenantBySessionFormateurAction(token, sessionId, fd)
    setSaving(false)
    if (r.success) { setOpen(false); router.refresh() }
    else setError(r.error || 'Erreur')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-900 text-white text-sm font-medium hover:bg-surface-800 transition-colors"
      >
        <UserPlus className="h-4 w-4" /> Ajouter un apprenant
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 sticky top-0 bg-white">
              <h2 className="text-lg font-heading font-bold text-surface-900">Nouvel apprenant</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-surface-400 hover:bg-surface-100"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom *" name="nom" required />
                <Field label="Prénom" name="prenom" />
              </div>
              <Field label="Adresse e-mail" name="email" type="email" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-surface-500">Sexe</label>
                  <select name="sexe" className="input-base text-sm">
                    <option value="">—</option>
                    <option value="H">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-surface-500">Date de naissance</label>
                  <input type="date" name="date_naissance" className="input-base text-sm" />
                </div>
              </div>
              <Field label="Adresse" name="adresse" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-surface-500">Type de contrat</label>
                  <select name="type_contrat" className="input-base text-sm">
                    {CONTRAT_OPTIONS.map((c) => <option key={c} value={c}>{c || '—'}</option>)}
                  </select>
                </div>
                <Field label="N° de sécurité sociale" name="numero_securite_sociale" />
              </div>

              {error && <p className="text-xs text-danger-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-100">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, name, type = 'text', required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-surface-500">{label}</label>
      <input type={type} name={name} required={required} className="input-base text-sm" />
    </div>
  )
}
