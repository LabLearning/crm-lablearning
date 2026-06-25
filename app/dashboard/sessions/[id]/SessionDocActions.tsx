'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSignature, Send, Loader2, Copy, Check, ClipboardCheck } from 'lucide-react'
import { useToast } from '@/components/ui'
import { sendConventionForSignatureAction, sendContratToFormateurAction } from './actions'

interface Props {
  sessionId: string
  hasClient: boolean
  hasFormateur: boolean
}

export function SessionDocActions({ sessionId, hasClient, hasFormateur }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<'conv' | 'contrat' | null>(null)
  const [signUrl, setSignUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function sendConvention() {
    setBusy('conv')
    startTransition(async () => {
      const r = await sendConventionForSignatureAction(sessionId)
      if (r.success) {
        if (r.data?.url) setSignUrl(r.data.url)
        if (r.warning) toast('info', r.warning)
        else toast('success', r.data?.email ? `Convention envoyée à ${r.data.email}` : 'Convention envoyée en signature')
        router.refresh()
      } else toast('error', r.error || 'Erreur')
      setBusy(null)
    })
  }

  function sendContrat() {
    setBusy('contrat')
    startTransition(async () => {
      const r = await sendContratToFormateurAction(sessionId)
      if (r.success) toast('success', r.data?.email ? `Contrat envoyé à ${r.data.email}` : 'Contrat envoyé au formateur')
      else toast('error', r.error || 'Erreur')
      setBusy(null)
    })
  }

  async function copyLink() {
    if (!signUrl) return
    await navigator.clipboard.writeText(signUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Documents à envoyer</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={sendConvention}
          disabled={pending || !hasClient}
          title={!hasClient ? 'Aucun client entreprise rattaché à la session' : undefined}
          className="flex items-center gap-3 rounded-xl border border-surface-200 px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            {busy === 'conv' ? <Loader2 className="h-4 w-4 text-brand-600 animate-spin" /> : <FileSignature className="h-4 w-4 text-brand-600" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-surface-900">Convention en signature</span>
            <span className="block text-xs text-surface-500">Au client, signature en ligne</span>
          </span>
        </button>

        <button
          onClick={sendContrat}
          disabled={pending || !hasFormateur}
          title={!hasFormateur ? 'Aucun formateur rattaché à la session' : undefined}
          className="flex items-center gap-3 rounded-xl border border-surface-200 px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            {busy === 'contrat' ? <Loader2 className="h-4 w-4 text-blue-600 animate-spin" /> : <Send className="h-4 w-4 text-blue-600" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-surface-900">Contrat de prestation</span>
            <span className="block text-xs text-surface-500">Au formateur, avec les infos de la session</span>
          </span>
        </button>
      </div>

      {signUrl && (
        <div className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2">
          <span className="text-xs text-surface-500 shrink-0">Lien de signature :</span>
          <span className="text-xs text-surface-700 truncate flex-1 font-mono">{signUrl}</span>
          <button onClick={copyLink} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0">
            {copied ? <><Check className="h-3.5 w-3.5" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
          </button>
        </div>
      )}
    </div>
  )
}
