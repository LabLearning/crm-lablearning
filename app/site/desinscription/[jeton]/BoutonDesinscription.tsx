'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2 } from '../../icons'
import { desinscrireAction } from '../actions'

export function BoutonDesinscription({ jeton, canal }: { jeton: string; canal: 'email' | 'sms' }) {
  const [pending, start] = useTransition()
  const [fait, setFait] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  if (fait) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[#205040]/20 bg-[#205040]/5 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#205040]" />
        <p className="text-[#14110F]">C’est fait : vous ne recevrez plus nos {canal === 'email' ? 'e-mails' : 'SMS'} d’actualités et d’offres.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <button type="button" disabled={pending}
        onClick={() => start(async () => {
          setErreur(null)
          const r = await desinscrireAction(jeton)
          if (r?.success) setFait(true)
          else setErreur(r?.error || 'La désinscription a échoué. Réessayez.')
        })}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#205040] px-6 text-sm font-semibold text-white hover:bg-[#1a4335] disabled:opacity-60 transition-colors">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Me désinscrire
      </button>
      {erreur && <p className="text-sm text-[#B91C1C]" role="alert">{erreur}</p>}
    </div>
  )
}
