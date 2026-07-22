'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  PenLine, Printer, Upload, CheckCircle2, Loader2, FileCheck2, RefreshCw,
} from 'lucide-react'
import { setSessionEmargementModeAction, saveScanSessionAction } from '../actions'
import { cn } from '@/lib/utils'

interface Props {
  token: string
  sessionId: string
  mode: 'numerique' | 'papier'
  scanPath: string | null
  scanUploadedAt: string | null
  /** Une feuille validée fige le mode : on n'autorise plus le changement */
  verrouille: boolean
}

/**
 * Choix du mode d'émargement pour TOUTE la session.
 * Le papier couvre l'ensemble des dates : une feuille imprimée, signée au
 * fil des séances, scannée une seule fois.
 */
export function ModeEmargement({ token, sessionId, mode, scanPath, scanUploadedAt, verrouille }: Props) {
  const router = useRouter()
  const { push } = router
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function choisir(nouveau: 'numerique' | 'papier') {
    setErreur(null)
    startTransition(async () => {
      const r = await setSessionEmargementModeAction(token, sessionId, nouveau)
      if (r.success) router.refresh()
      else setErreur(r.error || 'Erreur')
    })
  }

  async function envoyerScan(file: File) {
    setErreur(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('portal_token', token)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErreur(data.error || 'Transfert impossible'); return }
      const r = await saveScanSessionAction(token, sessionId, data.storage_path)
      if (r.success) router.refresh()
      else setErreur(r.error || 'Erreur')
    } catch {
      setErreur('Transfert impossible')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const pdfUrl = `/api/pdf/emargement/${sessionId}?token=${token}`

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Mode d&apos;émargement
        </h2>
        {verrouille && (
          <span className="text-[11px] text-surface-400">Figé — des feuilles sont validées</span>
        )}
      </div>

      {!verrouille ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => choisir('numerique')}
            disabled={pending}
            className={cn(
              'text-left rounded-xl border p-4 transition-colors disabled:opacity-50',
              mode === 'numerique'
                ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200'
                : 'border-surface-200 hover:border-surface-300',
            )}
          >
            <div className="flex items-center gap-2">
              <PenLine className={cn('h-4 w-4', mode === 'numerique' ? 'text-brand-600' : 'text-surface-400')} />
              <span className="text-sm font-semibold text-surface-900">Signature à l&apos;écran</span>
              {mode === 'numerique' && <CheckCircle2 className="h-4 w-4 text-brand-600 ml-auto" />}
            </div>
            <p className="text-xs text-surface-500 mt-1.5 leading-relaxed">
              Chaque stagiaire signe sur votre téléphone ou votre ordinateur, demi-journée par demi-journée.
            </p>
          </button>

          <button
            type="button"
            onClick={() => choisir('papier')}
            disabled={pending}
            className={cn(
              'text-left rounded-xl border p-4 transition-colors disabled:opacity-50',
              mode === 'papier'
                ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200'
                : 'border-surface-200 hover:border-surface-300',
            )}
          >
            <div className="flex items-center gap-2">
              <Printer className={cn('h-4 w-4', mode === 'papier' ? 'text-brand-600' : 'text-surface-400')} />
              <span className="text-sm font-semibold text-surface-900">Feuille papier</span>
              {mode === 'papier' && <CheckCircle2 className="h-4 w-4 text-brand-600 ml-auto" />}
            </div>
            <p className="text-xs text-surface-500 mt-1.5 leading-relaxed">
              Une feuille unique pour toute la session, imprimée et signée à la main, puis scannée.
            </p>
          </button>
        </div>
      ) : (
        <p className="text-sm text-surface-700">
          {mode === 'papier' ? 'Feuille papier' : 'Signature à l\'écran'}
        </p>
      )}

      {mode === 'papier' && (
        <div className="mt-4 pt-4 border-t border-surface-100 space-y-3">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-surface-900 text-white text-sm font-medium py-3 hover:bg-surface-800 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimer la feuille de la session
          </a>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) envoyerScan(f) }}
          />

          {scanPath ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="flex-1 text-sm text-emerald-900">
                Feuille signée reçue
                {scanUploadedAt && (
                  <span className="text-emerald-700">
                    {' '}le {new Date(scanUploadedAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-emerald-700 hover:underline shrink-0 inline-flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Remplacer
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-300 py-3 text-sm font-medium text-surface-600 hover:border-brand-300 hover:bg-brand-50/30 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Envoi en cours…' : 'Envoyer la feuille signée (photo ou PDF)'}
            </button>
          )}

          <p className="text-xs text-surface-500 leading-relaxed">
            La feuille scannée est la pièce qui fait foi en cas de contrôle. Pointez tout de même les
            présences ci-dessous : elles alimentent le taux d&apos;assiduité du dossier de financement.
          </p>
        </div>
      )}

      {erreur && <p className="text-xs text-danger-600 mt-3">{erreur}</p>}
    </div>
  )
}
