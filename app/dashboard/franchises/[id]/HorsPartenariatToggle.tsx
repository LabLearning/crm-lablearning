'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, History, RotateCcw } from '@/components/ui/icons'
import { setEtablissementHorsPartenariatAction } from '../actions'

/**
 * Sort un établissement de l'accord de commission, ou l'y remet. Utile quand
 * la seule date de partenariat ne suffit pas : un établissement formé avant
 * l'accord peut revenir se former après sans pour autant y entrer.
 */
export function HorsPartenariatToggle({ clientId, hors }: { clientId: string; hors: boolean }) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function basculer() {
    if (!hors && !confirm(
      "Sortir cet établissement de l'accord de commission ?\n\nSes sessions ne généreront plus de commission pour la franchise, quelle que soit leur date. Les commissions déjà validées ou payées ne bougent pas.",
    )) return
    setErreur(null)
    demarrer(async () => {
      const r = await setEtablissementHorsPartenariatAction(clientId, !hors)
      if (r.success) router.refresh()
      else setErreur(r.error || 'Modification impossible')
    })
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button" onClick={basculer} disabled={enCours}
        title={hors ? "Remettre dans l'accord de commission" : "Sortir de l'accord de commission"}
        className="p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 disabled:opacity-50"
      >
        {enCours ? <Loader2 className="h-4 w-4 animate-spin" />
          : hors ? <RotateCcw className="h-4 w-4" /> : <History className="h-4 w-4" />}
      </button>
      {erreur && <p className="text-[11px] text-danger-600 max-w-[180px]">{erreur}</p>}
    </div>
  )
}
