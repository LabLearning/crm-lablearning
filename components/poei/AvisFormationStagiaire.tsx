'use client'

import { APPRECIATIONS_STAGIAIRE } from '@/lib/poei-bilan-ft'

/**
 * Ce que le stagiaire pense de sa formation, saisi au moment où il signe :
 * une appréciation d'un geste, et un commentaire libre s'il le souhaite.
 * L'appréciation figure sur son bilan ; le commentaire reste à l'organisme.
 */
export function AvisFormationStagiaire({ note, avis, onNote, onAvis }: {
  note: string
  avis: string
  onNote: (v: string) => void
  onAvis: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-surface-700 mb-1.5">Comment avez-vous trouvé la formation ?</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Votre appréciation de la formation">
        {APPRECIATIONS_STAGIAIRE.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={note === n} onClick={() => onNote(n)}
            className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/50 ${note === n ? 'border-brand-500 bg-brand-500 text-white' : 'border-surface-200 bg-white text-surface-700 hover:bg-surface-50'}`}>
            {n}
          </button>
        ))}
      </div>
      <label htmlFor="avis-formation" className="block text-sm font-medium text-surface-700 mt-3 mb-1">Un commentaire ? <span className="font-normal text-surface-400">(facultatif)</span></label>
      <textarea id="avis-formation" rows={2} className="input-base resize-none" value={avis} maxLength={1500}
        onChange={(e) => onAvis(e.target.value)} placeholder="Ce que la formation vous a apporté, ce qui pourrait être amélioré…" />
      <p className="mt-1 text-xs text-surface-500">Votre commentaire est lu par l’organisme de formation seulement : il n’est pas reporté sur votre bilan.</p>
    </div>
  )
}
