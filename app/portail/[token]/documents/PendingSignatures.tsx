'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, PenLine, AlertCircle } from 'lucide-react'
import { SignaturePad } from '../emargement/SignaturePad'
import { signDocumentAction } from './actions'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/document'

interface PendingSignature {
  id: string
  signataire_nom: string
  document: { nom: string; type: string } | null
}

export function PendingSignatures({ token, signatures }: { token: string; signatures: PendingSignature[] }) {
  const router = useRouter()
  const [signingFor, setSigningFor] = useState<PendingSignature | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSign = (signatureBase64: string) => {
    if (!signingFor) return
    setError(null)
    startTransition(async () => {
      const result = await signDocumentAction(token, signingFor.id, signatureBase64)
      if (result.success) {
        setSigningFor(null)
        router.refresh()
      } else {
        setError(result.error || 'Erreur lors de la signature')
      }
    })
  }

  if (signatures.length === 0) return null

  return (
    <div className="card p-6 border border-warning-200">
      <h2 className="text-base font-heading font-semibold text-warning-700 mb-3">Documents à signer</h2>
      <div className="space-y-2">
        {signatures.map((sig) => (
          <div key={sig.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-warning-50">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-warning-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-surface-800 truncate">{sig.document?.nom || 'Document'}</div>
                <div className="text-xs text-surface-500">{(DOCUMENT_TYPE_LABELS as any)[sig.document?.type || 'autre']}</div>
              </div>
            </div>
            <button
              onClick={() => { setError(null); setSigningFor(sig) }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning-600 text-white text-xs font-semibold hover:bg-warning-700 transition-colors shrink-0"
            >
              <PenLine className="h-3.5 w-3.5" /> Signer
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-danger-600">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {signingFor && (
        <SignaturePad
          title="Signer le document"
          subtitle={signingFor.document?.nom || undefined}
          isPending={isPending}
          onSign={handleSign}
          onCancel={() => { if (!isPending) { setSigningFor(null); setError(null) } }}
          validateLabel="Signer le document"
        />
      )}
    </div>
  )
}
