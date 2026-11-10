'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'
import { CheckCircle2, Loader2, PenTool, XCircle } from '@/components/ui/icons'
import { lireFraisDeplacementFormateurAction, definirFraisDeplacementFormateurAction } from './frais-deplacement-actions'

const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/**
 * Case « Frais de déplacement du formateur » de la carte Rémunération : à part
 * du contrat signé, que rien ne modifie ; la marge et la commission franchise
 * (budget net) les déduisent.
 */
export function FraisDeplacementFormateur({ sessionId, formateurId, factureAuDessusDuContrat = false }: {
  sessionId: string; formateurId: string | null
  /** La facture du formateur dépasse son contrat : c'est elle qui sert de coût (lib/commission coutFormateurDeSession) */
  factureAuDessusDuContrat?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, start] = useTransition()
  const [etat, setEtat] = useState<{ montant: number | null; autres: number; formateur: boolean } | null>(null)
  const [edition, setEdition] = useState(false)
  const [valeur, setValeur] = useState('')

  const charger = useCallback(async () => {
    try {
      const r = await lireFraisDeplacementFormateurAction(sessionId)
      if (r?.success && r.data) setEtat(r.data)
    } catch { /* la case reste masquée, rien n'est perdu */ }
  }, [sessionId])
  // Rechargée aussi quand le formateur de la session change
  useEffect(() => { charger() }, [charger, formateurId])

  if (!etat || !etat.formateur) return null

  function ouvrir() {
    setValeur(etat?.montant != null ? String(etat.montant) : '')
    setEdition(true)
  }

  function enregistrer() {
    const brut = valeur.trim().replace(',', '.')
    const montant = brut === '' ? null : Number(brut)
    if (montant !== null && (!Number.isFinite(montant) || montant < 0 || (montant > 0 && Math.round(montant * 100) === 0))) { toast('error', 'Montant invalide'); return }
    start(async () => {
      let r: any = null
      try { r = await definirFraisDeplacementFormateurAction(sessionId, montant) } catch { r = null }
      if (r?.success) {
        setEdition(false)
        // Commission déjà validée ou payée : elle reste figée, on le dit
        if (r.warning) toast('warning', r.warning)
        else toast('success', montant ? 'Frais de déplacement enregistrés, sans toucher au contrat' : 'Frais de déplacement retirés')
        await charger()
        router.refresh()
      } else toast('error', r?.error || 'Enregistrement impossible, réessayez')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-surface-100 pt-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-surface-600">Frais de déplacement du formateur</div>
        <div className="text-sm font-semibold text-surface-900 tabular-nums mt-0.5">
          {etat.montant != null ? euros(etat.montant) : <span className="font-normal text-surface-400">Aucun</span>}
          {etat.autres > 0 && <span className="ml-1.5 text-xs font-normal text-surface-500">+ {euros(etat.autres)} de frais de déplacement saisis à part</span>}
        </div>
        <div className="text-2xs text-surface-500 mt-0.5">Montant payé, TVA comprise. Déduits de la marge et de la commission franchise, sans toucher au contrat. N&apos;y mettez pas un déplacement déjà compris dans la facture ou le contrat du formateur.</div>
        {factureAuDessusDuContrat && ((etat.montant || 0) + etat.autres) > 0 && (
          <div className="text-2xs text-warning-700 mt-1">La facture du formateur dépasse son contrat et sert de coût : si elle comprend déjà ce déplacement, retirez-le ici, sinon il est déduit deux fois.</div>
        )}
      </div>
      {edition ? (
        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <input
              type="number" min="0" step="0.01" inputMode="decimal" autoFocus value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') enregistrer(); if (e.key === 'Escape') setEdition(false) }}
              placeholder="0"
              aria-label="Frais de déplacement du formateur en euros, TVA comprise"
              className="w-full sm:w-32 pl-3 pr-7 py-2 min-h-[40px] sm:min-h-0 rounded-xl border border-brand-300 bg-white text-sm font-semibold text-surface-900 text-right focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-surface-400 pointer-events-none">€</span>
          </div>
          <button type="button" onClick={enregistrer} disabled={pending} aria-label="Enregistrer les frais de déplacement"
            className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setEdition(false)} aria-label="Annuler"
            className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl border border-surface-200 text-surface-400 hover:bg-surface-50 hover:text-surface-600 transition-colors">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={ouvrir}
          className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] sm:min-h-0 rounded-xl border border-surface-200 text-surface-600 text-sm font-medium hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600 transition-colors shrink-0 w-full sm:w-auto">
          <PenTool className="h-3.5 w-3.5" /> {etat.montant != null ? 'Modifier' : 'Ajouter'}
        </button>
      )}
    </div>
  )
}
