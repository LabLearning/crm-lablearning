'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2 } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { ouvrirQcmSessionAction } from './qcm-send-actions'

/**
 * « Ouvrir aux stagiaires » : le questionnaire, fermé jusque-là, apparaît
 * aussitôt dans l'espace de chaque stagiaire (sans mail ni message), quand le
 * cours en est là.
 */
export function OuvrirQcmButton({ token, sessionId, qcmSessionId, titre }: { token: string; sessionId: string; qcmSessionId: string; titre: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()

  function ouvrir() {
    // L'ouverture est définitive : on vérifie que c'est la bonne ligne
    if (!window.confirm(`Ouvrir « ${titre} » aux stagiaires ?\n\nIl apparaîtra sur leur téléphone et ne pourra plus être refermé.`)) return
    start(async () => {
      const r = await ouvrirQcmSessionAction(sessionId, qcmSessionId, token || null)
      if (r.success) { toast('success', `« ${titre} » est ouvert : les stagiaires le voient sur leur téléphone`); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <button onClick={ouvrir} disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-900 text-white text-xs font-semibold hover:bg-surface-800 disabled:opacity-50 transition-colors shrink-0">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Ouvrir aux stagiaires
    </button>
  )
}
