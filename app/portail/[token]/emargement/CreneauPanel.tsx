'use client'

import { useRef, useState, useTransition } from 'react'
import {
  CheckCircle2,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
  UserX,
  XCircle,
  Printer,
  Upload,
  FileCheck2,
  Trash2,
  MonitorSmartphone,
  FileText,
  RefreshCw,
} from 'lucide-react'
import {
  signApprenantPresenceAction,
  markAbsentAction,
  markPresentPapierAction,
  validerFeuilleByFormateurAction,
  attesterFeuillePapierAction,
  setFeuilleModeAction,
  saveScanFeuilleAction,
} from './actions'
import { SignaturePad } from './SignaturePad'
import { creneauLabel, formatFullDate, type Creneau } from './helpers'

export interface EmargementRow {
  id: string
  apprenant_id: string
  est_present: boolean
  creneau: string
  signature_data: string | null
  signed_at: string | null
  motif_absence: string | null
  apprenant: { prenom: string; nom: string } | null
}

export interface FeuilleRow {
  id: string
  mode: 'numerique' | 'papier' | null
  scan_storage_path: string | null
  formateur_signature_data: string | null
  validated_at: string | null
}

interface Props {
  token: string
  sessionId: string
  date: string
  creneau: string
  emargements: EmargementRow[]
  feuille: FeuilleRow | null
  scanUrl?: string | null
  /** Mode retenu pour toute la session : le créneau n'en décide plus */
  modeSession: 'numerique' | 'papier'
  onChange: () => void
}

function apprenantName(em: EmargementRow) {
  return `${em.apprenant?.prenom || ''} ${em.apprenant?.nom || ''}`.trim() || 'Apprenant'
}

function isSettled(em: EmargementRow) {
  return em.est_present || !!em.motif_absence
}

export function CreneauStatus({
  emargements,
  feuille,
}: {
  emargements: EmargementRow[]
  feuille: FeuilleRow | null
}) {
  const total = emargements.length
  const settled = emargements.filter(isSettled).length

  if (feuille?.validated_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
        <Lock className="h-3 w-3" /> Validée
      </span>
    )
  }
  if (settled === 0) {
    return (
      <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-surface-100 text-surface-500">
        Non commencé
      </span>
    )
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700">
      En cours · {settled}/{total}
    </span>
  )
}

/** Ligne apprenant : présentation identique dans les deux modes, actions différentes. */
function ApprenantRow({
  em,
  locked,
  mode,
  onSign,
  onPresent,
  onAbsent,
}: {
  em: EmargementRow
  locked: boolean
  mode: 'numerique' | 'papier'
  onSign: () => void
  onPresent: () => void
  onAbsent: () => void
}) {
  const signed = em.est_present && !!em.signature_data
  const presentPapier = em.est_present && !em.signature_data
  const absent = !em.est_present && !!em.motif_absence

  return (
    <div
      className={`px-4 py-3 border-b border-surface-100/70 last:border-0 ${
        em.est_present ? 'bg-emerald-50/40' : absent ? 'bg-rose-50/40' : 'bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
            em.est_present ? 'bg-emerald-100' : absent ? 'bg-rose-100' : 'bg-surface-100'
          }`}
        >
          {em.est_present ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : absent ? (
            <UserX className="h-5 w-5 text-rose-500" />
          ) : (
            <PenLine className="h-5 w-5 text-surface-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-surface-900 truncate">{apprenantName(em)}</div>
          {signed && em.signed_at && (
            <div className="text-[11px] text-emerald-600 mt-0.5">
              Signé · {new Date(em.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          {presentPapier && <div className="text-[11px] text-emerald-600 mt-0.5">Présent · feuille papier</div>}
          {absent && <div className="text-[11px] text-rose-500 mt-0.5 truncate">Absent · {em.motif_absence}</div>}
          {!em.est_present && !absent && (
            <div className="text-[11px] text-surface-400 mt-0.5">
              {mode === 'papier' ? 'À pointer' : 'En attente de signature'}
            </div>
          )}
        </div>

        {signed && em.signature_data && (
          <img
            src={em.signature_data}
            alt="signature"
            className="shrink-0 h-10 w-16 object-contain bg-white border border-emerald-200 rounded"
          />
        )}
      </div>

      {!locked && (
        <div className="flex gap-2 mt-2.5">
          {mode === 'numerique' ? (
            <button
              onClick={onSign}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold min-h-[44px] px-3 rounded-xl bg-surface-900 text-white active:bg-surface-800 transition-colors"
            >
              <PenLine className="h-4 w-4" /> {signed ? 'Signer à nouveau' : 'Signer'}
            </button>
          ) : (
            <button
              onClick={onPresent}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold min-h-[44px] px-3 rounded-xl transition-colors ${
                em.est_present
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-surface-200 text-surface-700 active:bg-surface-50'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" /> Présent
            </button>
          )}
          <button
            onClick={onAbsent}
            className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium min-h-[44px] px-4 rounded-xl transition-colors ${
              absent
                ? 'bg-rose-600 text-white'
                : 'bg-white border border-surface-200 text-surface-500 active:bg-rose-50'
            }`}
          >
            <XCircle className="h-4 w-4" /> Absent
          </button>
        </div>
      )}
    </div>
  )
}

export function CreneauPanel({
  token,
  sessionId,
  date,
  creneau,
  emargements,
  feuille,
  scanUrl,
  modeSession,
  onChange,
}: Props) {
  const [signingFor, setSigningFor] = useState<EmargementRow | null>(null)
  const [absentingFor, setAbsentingFor] = useState<EmargementRow | null>(null)
  const [absentMotif, setAbsentMotif] = useState('')
  const [validateMode, setValidateMode] = useState(false)
  const [changingMode, setChangingMode] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const locked = !!feuille?.validated_at
  // Le mode est celui de la session : un créneau ne peut plus diverger
  const mode = modeSession
  const total = emargements.length
  const settled = emargements.filter(isSettled).length
  const allSettled = total > 0 && settled === total
  const creneauTyped = creneau as Creneau

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        after?.()
        onChange()
      } else {
        setError(result.error || 'Erreur')
      }
    })
  }

  const chooseMode = (next: 'numerique' | 'papier') =>
    run(() => setFeuilleModeAction(token, sessionId, date, creneauTyped, next), () =>
      setChangingMode(false),
    )

  async function handleUpload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('portal_token', token)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors du transfert')
        return
      }
      const saved = await saveScanFeuilleAction(token, sessionId, date, creneauTyped, data.storage_path)
      if (!saved.success) {
        setError(saved.error || 'Erreur')
        return
      }
      onChange()
    } catch {
      setError('Erreur lors du transfert')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Feuille verrouillée ─────────────────────────────────────
  if (locked) {
    const presents = emargements.filter((e) => e.est_present).length
    return (
      <div className="px-4 py-4 bg-emerald-50/50">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-700">
              Feuille validée · {feuille?.mode === 'papier' ? 'feuille papier' : 'signature numérique'}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              {presents}/{total} présents
              {feuille?.validated_at && ` · ${new Date(feuille.validated_at).toLocaleString('fr-FR')}`}
            </div>
            {scanUrl && (
              <a
                href={scanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700 underline"
              >
                <FileCheck2 className="h-3.5 w-3.5" /> Voir le scan de la feuille signée
              </a>
            )}
          </div>
          {feuille?.formateur_signature_data && (
            <img
              src={feuille.formateur_signature_data}
              alt="signature formateur"
              className="shrink-0 h-12 w-24 object-contain bg-white border border-emerald-200 rounded"
            />
          )}
        </div>
      </div>
    )
  }

  // ── Choix du mode (désormais au niveau de la session) ───────
  if (false) {
    return (
      <div className="px-4 py-4 bg-surface-50/60 space-y-3">
        <p className="text-xs text-surface-500">Comment souhaitez-vous faire signer ce créneau ?</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            onClick={() => chooseMode('numerique')}
            disabled={isPending}
            className="text-left p-4 rounded-xl border border-surface-200 bg-white active:bg-surface-50 transition-colors disabled:opacity-50"
          >
            <MonitorSmartphone className="h-5 w-5 text-surface-700" />
            <div className="text-sm font-semibold text-surface-900 mt-2">Signature numérique</div>
            <div className="text-xs text-surface-500 mt-0.5">
              Chaque stagiaire signe sur cet écran, puis vous validez la feuille.
            </div>
          </button>
          <button
            onClick={() => chooseMode('papier')}
            disabled={isPending}
            className="text-left p-4 rounded-xl border border-surface-200 bg-white active:bg-surface-50 transition-colors disabled:opacity-50"
          >
            <FileText className="h-5 w-5 text-surface-700" />
            <div className="text-sm font-semibold text-surface-900 mt-2">Feuille papier</div>
            <div className="text-xs text-surface-500 mt-0.5">
              Vous imprimez la feuille, la faites signer, puis pointez et téléversez le scan.
            </div>
          </button>
        </div>
        {changingMode && (
          <button
            onClick={() => setChangingMode(false)}
            className="text-xs font-medium text-surface-500 underline"
          >
            Annuler
          </button>
        )}
        {error && <div className="text-xs text-rose-600">{error}</div>}
      </div>
    )
  }

  // ── Émargement en cours ─────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface-50/80 border-b border-surface-100">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-700">
          {mode === 'papier' ? (
            <FileText className="h-3.5 w-3.5 text-surface-500" />
          ) : (
            <MonitorSmartphone className="h-3.5 w-3.5 text-surface-500" />
          )}
          {mode === 'papier' ? 'Feuille papier' : 'Signature numérique'}
        </span>
      </div>


      {emargements.map((em) => (
        <ApprenantRow
          key={em.id}
          em={em}
          locked={locked}
          mode={mode}
          onSign={() => setSigningFor(em)}
          onPresent={() => run(() => markPresentPapierAction(token, em.id))}
          onAbsent={() => {
            setAbsentMotif(em.motif_absence || '')
            setAbsentingFor(em)
          }}
        />
      ))}

      <div className="px-4 py-4 bg-surface-50 border-t border-surface-200 space-y-3">
        {mode === 'papier' && (
          <div>
            <div className="text-xs font-semibold text-surface-600 mb-1.5">
              Scan de la feuille signée <span className="font-normal text-surface-400">(optionnel)</span>
            </div>
            {feuille?.scan_storage_path ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-surface-200">
                <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-surface-600 truncate">
                  {feuille.scan_storage_path.split('/').pop()}
                </span>
                <button
                  onClick={() =>
                    run(() => saveScanFeuilleAction(token, sessionId, date, creneauTyped, null))
                  }
                  disabled={isPending}
                  className="p-2 rounded-lg text-surface-400 active:bg-surface-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border border-dashed border-surface-300 bg-white text-sm font-medium text-surface-600 active:bg-surface-50 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Téléverser le scan (photo ou PDF)
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                  }}
                />
              </>
            )}
          </div>
        )}

        <div className="text-xs text-surface-500">
          {allSettled
            ? mode === 'papier'
              ? 'Pointage terminé. Attestez la feuille avec votre signature.'
              : 'Tous les stagiaires sont renseignés. Validez la feuille avec votre signature.'
            : `${settled}/${total} stagiaires renseignés — complétez avant de valider.`}
        </div>

        <button
          onClick={() => setValidateMode(true)}
          disabled={!allSettled || isPending}
          className="w-full flex items-center justify-center gap-2 min-h-[52px] px-4 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShieldCheck className="h-4 w-4" />
          {mode === 'papier' ? 'Attester la feuille signée' : 'Valider et signer la feuille'}
        </button>

        {error && <div className="text-xs text-rose-600">{error}</div>}
      </div>

      {signingFor && (
        <SignaturePad
          title="Signature du stagiaire"
          subtitle={apprenantName(signingFor)}
          isPending={isPending}
          onSign={(sig) =>
            run(() => signApprenantPresenceAction(token, signingFor.id, sig), () => setSigningFor(null))
          }
          onCancel={() => setSigningFor(null)}
          validateLabel="Confirmer la signature"
        />
      )}

      {validateMode && (
        <SignaturePad
          title={mode === 'papier' ? 'Attestation du formateur' : 'Validation de la feuille'}
          subtitle={`${creneauLabel(creneau)} · ${formatFullDate(date)}`}
          isPending={isPending}
          onSign={(sig) =>
            run(
              () =>
                mode === 'papier'
                  ? attesterFeuillePapierAction(
                      token,
                      sessionId,
                      date,
                      creneauTyped,
                      sig,
                      feuille?.scan_storage_path || null,
                    )
                  : validerFeuilleByFormateurAction(token, sessionId, date, creneauTyped, sig),
              () => setValidateMode(false),
            )
          }
          onCancel={() => setValidateMode(false)}
          validateLabel="Verrouiller la feuille"
        />
      )}

      {absentingFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-modal w-full max-w-md overflow-hidden animate-slide-up">
            <div className="px-5 pt-5 pb-3">
              <div className="text-base font-heading font-semibold text-surface-900">Marquer absent</div>
              <div className="text-sm text-surface-500 mt-0.5">{apprenantName(absentingFor)}</div>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <textarea
                value={absentMotif}
                onChange={(e) => setAbsentMotif(e.target.value)}
                placeholder="Motif (optionnel) : maladie, retard, justifié, etc."
                rows={3}
                className="input-base w-full text-sm resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAbsentingFor(null)
                    setAbsentMotif('')
                  }}
                  disabled={isPending}
                  className="flex-1 min-h-[48px] px-4 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 active:bg-surface-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() =>
                    run(
                      // Un motif vide laisserait la ligne « ni présent ni absent » et
                      // bloquerait la validation de la feuille.
                      () => markAbsentAction(token, absentingFor.id, absentMotif.trim() || 'Non précisé'),
                      () => {
                        setAbsentingFor(null)
                        setAbsentMotif('')
                      },
                    )
                  }
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl bg-rose-600 active:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                  Confirmer absent
                </button>
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
