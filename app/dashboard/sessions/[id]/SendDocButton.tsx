'use client'

import { useState, useTransition } from 'react'
import { Send, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui'
import { sendDocumentToApprenantAction } from '../actions'

export function SendDocButton({
  sessionId, apprenantId, docType, label,
}: {
  sessionId: string
  apprenantId: string
  docType: 'attestation' | 'certificat'
  label: string
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const handleClick = () => {
    startTransition(async () => {
      const r = await sendDocumentToApprenantAction(sessionId, apprenantId, docType)
      if (r.success) {
        setDone(true)
        const wa = r.whatsapp
        if (wa === 'sent') toast('success', `${label} envoyé par WhatsApp`)
        else if (wa === 'dev') toast('success', `${label} émis (WhatsApp en mode test)`)
        else if (wa === 'skipped') toast('success', `${label} émis · disponible dans le portail`)
        else toast('success', `${label} émis`)
        setTimeout(() => setDone(false), 2500)
      } else {
        toast('error', r.error || 'Erreur')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={`Envoyer ${label.toLowerCase()} à l'apprenant`}
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-medium hover:bg-emerald-100 transition-colors disabled:opacity-60"
    >
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
      {label}
    </button>
  )
}
