'use client'

import { useState } from 'react'
import { CheckCircle2 } from '@/components/ui/icons'
import { deposerEvaluationFormateurAction } from './actions'

function Echelle({ name, label }: { name: string; label: string }) {
  const [v, setV] = useState<number | null>(null)
  return (
    <div>
      <div className="text-sm font-medium text-surface-800 mb-1.5">{label}</div>
      <input type="hidden" name={name} value={v ?? ''} />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setV(n)}
            className={`h-9 w-9 rounded-xl text-sm font-semibold transition-colors ${
              v === n ? 'bg-surface-900 text-white' : 'bg-white border border-surface-200 text-surface-500 hover:border-surface-400'}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function EvaluationFormateurForm({
  token, formateurNom, dejaRepondu, questions, repondant,
}: {
  token: string
  formateurNom: string
  dejaRepondu: boolean
  questions: { cle: string; label: string }[]
  repondant: { nom: string; fonction: string; email: string }
}) {
  const [envoi, setEnvoi] = useState(false)
  const [fini, setFini] = useState(dejaRepondu)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null); setEnvoi(true)
    const r = await deposerEvaluationFormateurAction(token, new FormData(e.currentTarget))
    setEnvoi(false)
    if (r.success) setFini(true)
    else setErreur(r.error || 'Une erreur est survenue.')
  }

  if (fini) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <div className="font-heading text-lg font-bold text-surface-900">Merci pour votre retour</div>
        <p className="text-sm text-surface-500 mt-1.5">
          {dejaRepondu
            ? 'Votre évaluation a déjà été enregistrée pour ce formateur.'
            : `Votre évaluation de ${formateurNom} est enregistrée et alimente notre démarche qualité.`}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={soumettre} className="card p-6 space-y-5">
      <input type="text" name="site_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <p className="text-xs text-surface-500">Notez de 1 (insuffisant) à 5 (excellent).</p>

      {questions.map((q) => <Echelle key={q.cle} name={q.cle} label={q.label} />)}
      <Echelle name="note_globale" label={`Appréciation globale de ${formateurNom}`} />

      <div>
        <div className="text-sm font-medium text-surface-800 mb-1.5">Souhaiteriez-vous retravailler avec ce formateur ?</div>
        <div className="flex gap-3 text-sm">
          {['oui', 'non'].map((v) => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="recommande" value={v} className="accent-surface-900" />
              {v === 'oui' ? 'Oui' : 'Non'}
            </label>
          ))}
        </div>
      </div>

      <label className="block text-sm font-medium text-surface-800">
        Vos remarques <span className="text-danger-600" aria-hidden="true">*</span>
        <span className="block text-xs font-normal text-surface-500 mt-0.5">
          Quelques phrases suffisent : ce qui vous a satisfait, ce que le formateur aurait pu faire autrement, une situation marquante.
        </span>
        <textarea name="commentaire" rows={4} required minLength={20} className="input-base mt-1.5 font-normal"
          placeholder="Points forts, points à améliorer, situations marquantes…" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-surface-500">Nom et prénom
          <input name="nom" defaultValue={repondant.nom} className="input-base mt-1" />
        </label>
        <label className="text-xs text-surface-500">Fonction
          <input name="fonction" defaultValue={repondant.fonction} className="input-base mt-1" />
        </label>
      </div>
      <label className="block text-xs text-surface-500">Email
        <input name="email" type="email" defaultValue={repondant.email} className="input-base mt-1" />
      </label>

      {erreur && <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{erreur}</div>}

      <button type="submit" disabled={envoi}
        className="w-full rounded-full bg-surface-900 text-white py-3 text-sm font-semibold hover:bg-surface-800 transition-colors disabled:opacity-60">
        {envoi ? 'Envoi…' : 'Envoyer mon évaluation'}
      </button>
    </form>
  )
}
