'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle, Copy, ExternalLink, PenTool } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { generateSignatureLinkAction } from '../signature-actions'
import { formatDate, formatDateTime } from '@/lib/utils'

interface Props {
  conventionId: string
  status: string
  signatureUrl: string | null
  signatureClientDate: string | null
  signatureClientNom: string | null
  signatureOfDate: string | null
  signatureOfNom: string | null
  signatureTokenExpiresAt: string | null
}

export function ConventionSignatureBlock({
  conventionId, status, signatureUrl, signatureClientDate, signatureClientNom,
  signatureOfDate, signatureOfNom, signatureTokenExpiresAt,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState(signatureUrl)

  const isSigned = ['signee_client', 'signee_of', 'signee_complete'].includes(status)
  const expired = signatureTokenExpiresAt && new Date(signatureTokenExpiresAt) < new Date()

  async function generateLink() {
    setLoading(true)
    const r = await generateSignatureLinkAction(conventionId)
    if (r.success && (r.data as any)?.url) {
      const newUrl = (r.data as any).url
      setUrl(newUrl)
      try {
        await navigator.clipboard.writeText(newUrl)
        toast('success', 'Lien copié dans le presse-papier')
      } catch {
        toast('success', 'Lien généré')
      }
    } else toast('error', r.error || 'Erreur')
    setLoading(false)
  }

  async function copyLink() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('success', 'Lien copié')
    } catch {
      toast('error', 'Copie impossible')
    }
  }

  if (isSigned) {
    return (
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
          <CheckCircle2 className="h-3.5 w-3.5" /> Signatures
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-surface-900">Client</div>
              {signatureClientDate ? (
                <div className="text-xs text-surface-600">
                  Signé par <strong>{signatureClientNom}</strong><br />
                  le {formatDateTime(signatureClientDate)}
                </div>
              ) : <div className="text-xs text-surface-500">En attente</div>}
            </div>
          </div>
          <div className="flex items-start gap-2">
            {signatureOfDate
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              : <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            }
            <div>
              <div className="font-medium text-surface-900">Lab Learning (OF)</div>
              {signatureOfDate ? (
                <div className="text-xs text-surface-600">
                  Signé par <strong>{signatureOfNom}</strong><br />
                  le {formatDateTime(signatureOfDate)}
                </div>
              ) : <div className="text-xs text-amber-700">En attente — à contre-signer côté OF</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-3 bg-amber-50/40 border-amber-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider">
          <PenTool className="h-3.5 w-3.5" /> Signature électronique
        </div>
      </div>

      {url && !expired ? (
        <div className="space-y-2">
          <div className="text-sm text-amber-900">
            Lien de signature actif (valable jusqu'au {signatureTokenExpiresAt && formatDate(signatureTokenExpiresAt)}).
            Envoyez-le au client par email ou WhatsApp.
          </div>
          <div className="flex gap-2 items-center bg-white border border-amber-200 rounded-lg px-3 py-2">
            <code className="text-xs text-surface-700 truncate flex-1">{url}</code>
            <button onClick={copyLink} className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
              <Copy className="h-3 w-3" /> Copier
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
              <ExternalLink className="h-3 w-3" /> Ouvrir
            </a>
          </div>
          <Button size="sm" variant="secondary" onClick={generateLink} isLoading={loading} icon={<Send className="h-3.5 w-3.5" />}>
            Régénérer un nouveau lien (et copier)
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {expired && (
            <div className="text-sm text-amber-800 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Le lien précédent a expiré.
            </div>
          )}
          <div className="text-sm text-amber-900">
            Aucun lien de signature actif. Génère-en un et envoie-le au client.
          </div>
          <Button onClick={generateLink} isLoading={loading} icon={<Send className="h-4 w-4" />}>
            Générer le lien de signature
          </Button>
        </div>
      )}
    </div>
  )
}
