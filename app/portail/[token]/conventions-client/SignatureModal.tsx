'use client'

import { useState } from 'react'
import { FileSignature, CheckCircle2, X } from 'lucide-react'
import { signConventionAction } from './actions'
import { SignaturePad } from '../emargement/SignaturePad'
import { formatDate } from '@/lib/utils'

interface SignatureModalProps {
  token: string
  convention: {
    id: string
    numero: string
    formation: any
    montant_ht: number | null
  }
  signataireName: string
  onSuccess: () => void
  onClose: () => void
}

export function SignatureModal({
  token,
  convention,
  signataireName,
  onSuccess,
  onClose,
}: SignatureModalProps) {
  const [name, setName] = useState(signataireName)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [showPad, setShowPad] = useState(false)

  // Étape 1 : valider nom + conditions, puis ouvrir le pad de signature
  function handleContinue() {
    if (!name.trim()) {
      setError('Veuillez saisir votre nom complet.')
      return
    }
    if (!accepted) {
      setError("Vous devez accepter les conditions pour signer.")
      return
    }
    setError(null)
    setShowPad(true)
  }

  // Étape 2 : signature tracée → enregistrement
  async function handleSign(signatureDataUrl: string) {
    setLoading(true)
    setError(null)

    const result = await signConventionAction(token, convention.id, name.trim(), signatureDataUrl)

    setLoading(false)
    setShowPad(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue.')
      return
    }

    const now = new Date().toISOString()
    setSignedAt(now)

    setTimeout(() => {
      onSuccess()
    }, 1800)
  }

  // Étape 2 : pad de signature (par-dessus la modale)
  if (showPad && !signedAt) {
    return (
      <SignaturePad
        title="Signer la convention"
        subtitle={`${convention.numero} — ${name.trim()}`}
        onSign={handleSign}
        onCancel={() => setShowPad(false)}
        isPending={loading}
        validateLabel="Valider et signer"
      />
    )
  }

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/50 p-4">
      <div className="card w-full max-w-md p-6 relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-brand-500" />
            <h2 className="font-heading font-semibold text-surface-900 text-base">
              Signer la convention
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {signedAt ? (
          // Success state
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-success-500 mb-3" />
            <p className="font-heading font-semibold text-surface-900 mb-1">
              Convention signee
            </p>
            <p className="text-sm text-surface-500">
              Signee le{' '}
              {formatDate(signedAt, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        ) : (
          <>
            {/* Convention details */}
            <div className="bg-surface-50 rounded-lg p-4 mb-5 space-y-1.5 text-sm text-surface-600">
              <div className="font-medium text-surface-900">
                {convention.formation?.intitule || convention.numero}
              </div>
              <div>Reference : {convention.numero}</div>
              {convention.montant_ht != null && (
                <div>
                  Montant HT :{' '}
                  {Number(convention.montant_ht).toLocaleString('fr-FR')} EUR
                </div>
              )}
            </div>

            {/* Legal text */}
            <p className="text-sm text-surface-500 mb-5 leading-relaxed">
              En signant cette convention, vous acceptez les conditions
              generales de formation et vous engagez a respecter les
              modalites de paiement convenues.
            </p>

            {/* Name input */}
            <div className="mb-4">
              <label className="section-label block mb-1.5">
                Votre nom complet
              </label>
              <input
                type="text"
                className="input-base w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prenom Nom"
              />
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-surface-300 accent-brand-500"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span className="text-sm text-surface-600">
                J&apos;ai lu et j&apos;accepte les conditions de cette
                convention
              </span>
            </label>

            {/* Error */}
            {error && (
              <p className="text-sm text-danger-600 mb-4">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-surface-500 hover:text-surface-700 transition-colors px-3 py-2"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FileSignature className="h-4 w-4" />
                {loading ? 'Signature en cours...' : 'Signer la convention'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
