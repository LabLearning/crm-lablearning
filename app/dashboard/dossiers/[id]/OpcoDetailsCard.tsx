'use client'

import { useState, useRef } from 'react'
import { Hash, FileText, Upload, Check, X, ExternalLink, Trash2 } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { updateOpcoNumeroAction } from '../opco-actions'

interface OpcoDetailsCardProps {
  dossierId: string
  initialNumero: string | null
  accordUrl: string | null
  accordFilename: string | null
  accordUploadedAt: string | null
  workflowStatus: string | null
}

export function OpcoDetailsCard({
  dossierId, initialNumero, accordUrl, accordFilename, accordUploadedAt, workflowStatus,
}: OpcoDetailsCardProps) {
  const { toast } = useToast()
  const [numero, setNumero] = useState(initialNumero || '')
  const [savingNumero, setSavingNumero] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [currentAccord, setCurrentAccord] = useState({ url: accordUrl, filename: accordFilename, uploadedAt: accordUploadedAt })

  async function saveNumero() {
    setSavingNumero(true)
    const r = await updateOpcoNumeroAction(dossierId, numero)
    if (r.success) toast('success', 'Numéro de dossier OPCO sauvegardé')
    else toast('error', r.error || 'Erreur')
    setSavingNumero(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast('error', 'Fichier trop lourd (max 10 Mo)'); return }
    setUploading(true)
    const fd = new FormData()
    fd.set('file', file)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/upload-accord`, { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.success) {
        setCurrentAccord({ url: data.url, filename: data.filename, uploadedAt: new Date().toISOString() })
        toast('success', 'Accord uploadé')
      } else {
        toast('error', data.error || 'Erreur upload')
      }
    } catch (err) {
      toast('error', 'Erreur réseau')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const canMiseEnPaiement = !!currentAccord.url
  const isPaymentStep = workflowStatus === 'valide_opco' || workflowStatus === 'mise_en_paiement' || workflowStatus === 'paye'

  return (
    <div className="card p-5 space-y-4">
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Détails OPCO</div>

      {/* Numéro de dossier OPCO */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-700">
          <Hash className="h-3.5 w-3.5 inline mr-1" />
          Numéro de dossier OPCO
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            className="input-base flex-1"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: AKTO-2026-12345"
          />
          <Button
            size="sm"
            onClick={saveNumero}
            isLoading={savingNumero}
            disabled={numero === (initialNumero || '')}
            icon={<Check className="h-3.5 w-3.5" />}
          >
            Sauvegarder
          </Button>
        </div>
        <p className="text-xs text-surface-500">
          Numéro retourné par l'OPCO après l'envoi de la demande de prise en charge.
        </p>
      </div>

      {/* Accord de prise en charge */}
      <div className="space-y-1.5 pt-3 border-t border-surface-100">
        <label className="block text-sm font-medium text-surface-700">
          <FileText className="h-3.5 w-3.5 inline mr-1" />
          Accord de prise en charge
          {isPaymentStep && !currentAccord.url && (
            <span className="ml-2 text-xs font-normal text-amber-600">(requis pour la mise en paiement)</span>
          )}
        </label>

        {currentAccord.url ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-emerald-900 truncate">{currentAccord.filename || 'Accord uploadé'}</div>
              {currentAccord.uploadedAt && (
                <div className="text-xs text-emerald-700">
                  Uploadé le {new Date(currentAccord.uploadedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' as any })}
                </div>
              )}
            </div>
            <a href={currentAccord.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 shrink-0">
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
            </a>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-surface-500 hover:text-surface-800 flex items-center gap-1 shrink-0"
              title="Remplacer"
            >
              <Upload className="h-3.5 w-3.5" /> Remplacer
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full p-4 rounded-xl border-2 border-dashed border-surface-300 hover:border-brand-300 hover:bg-brand-50/40 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
          >
            <Upload className="h-5 w-5 text-surface-400" />
            <div className="text-sm text-surface-700">
              {uploading ? 'Upload en cours…' : 'Cliquer pour uploader le PDF de l\'accord OPCO'}
            </div>
            <div className="text-xs text-surface-400">PDF, PNG ou JPG · 10 Mo max</div>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={handleUpload}
        />

        {!canMiseEnPaiement && workflowStatus === 'valide_opco' && (
          <p className="text-xs text-amber-700 mt-1">
            Uploadez l'accord de prise en charge avant de cliquer sur "Mettre en paiement".
          </p>
        )}
      </div>
    </div>
  )
}
