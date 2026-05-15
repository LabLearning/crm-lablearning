'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Plus,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lock,
  PenLine,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import {
  signApprenantPresenceAction,
  markAbsentAction,
  validerFeuilleByFormateurAction,
  createEmargementAction,
} from './actions'
import { SignaturePad } from './SignaturePad'

interface Emargement {
  id: string
  apprenant_id: string
  est_present: boolean
  creneau: string
  signature_data: string | null
  signed_at: string | null
  motif_absence: string | null
  apprenant: { prenom: string; nom: string } | null
}

interface Feuille {
  id: string
  formateur_signature_data: string | null
  validated_at: string | null
}

interface DateRow {
  date: string
  creneaux: {
    creneau: string
    emargements: Emargement[]
    feuille: Feuille | null
  }[]
}

interface Session {
  id: string
  reference: string
  date_debut: string
  date_fin: string
  formation: any
  dates: DateRow[]
}

interface Props {
  token: string
  sessions: Session[]
}

function formatFullDate(dateStr: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dateStr))
}

function formatShortDate(dateStr: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(dateStr))
}

function creneauLabel(c: string) {
  if (c === 'matin') return 'Matin'
  if (c === 'apres_midi') return 'Après-midi'
  return 'Journée'
}

function CreneauSection({
  token,
  sessionId,
  date,
  creneau,
  emargements,
  feuille,
  onChange,
}: {
  token: string
  sessionId: string
  date: string
  creneau: string
  emargements: Emargement[]
  feuille: Feuille | null
  onChange: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [signingFor, setSigningFor] = useState<Emargement | null>(null)
  const [absentingFor, setAbsentingFor] = useState<Emargement | null>(null)
  const [absentMotif, setAbsentMotif] = useState('')
  const [validateMode, setValidateMode] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const locked = !!feuille?.validated_at
  const signedCount = emargements.filter((e) => e.est_present && e.signature_data).length
  const absentCount = emargements.filter((e) => !e.est_present && e.motif_absence).length
  const total = emargements.length
  const allSettled = emargements.every((e) => (e.est_present && e.signature_data) || (!e.est_present && e.motif_absence))

  const handleSign = (signatureBase64: string) => {
    if (!signingFor) return
    setError(null)
    startTransition(async () => {
      const result = await signApprenantPresenceAction(token, signingFor.id, signatureBase64)
      if (result.success) {
        setSigningFor(null)
        onChange()
      } else {
        setError(result.error || 'Erreur')
      }
    })
  }

  const handleAbsent = () => {
    if (!absentingFor) return
    setError(null)
    startTransition(async () => {
      const result = await markAbsentAction(token, absentingFor.id, absentMotif || null)
      if (result.success) {
        setAbsentingFor(null)
        setAbsentMotif('')
        onChange()
      } else {
        setError(result.error || 'Erreur')
      }
    })
  }

  const handleValidate = (signatureBase64: string) => {
    setError(null)
    startTransition(async () => {
      const result = await validerFeuilleByFormateurAction(
        token,
        sessionId,
        date,
        creneau as 'matin' | 'apres_midi' | 'journee',
        signatureBase64,
      )
      if (result.success) {
        setValidateMode(false)
        onChange()
      } else {
        setError(result.error || 'Erreur')
      }
    })
  }

  return (
    <div className="border-b border-surface-100 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-surface-50/60 hover:bg-surface-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 text-surface-400 shrink-0" />
          <span className="text-sm font-medium text-surface-800 capitalize truncate">
            {formatFullDate(date)}
          </span>
          <span className="text-xs text-surface-500 shrink-0">· {creneauLabel(creneau)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {locked ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <Lock className="h-3 w-3" /> Validée
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-200 text-surface-600">
              {signedCount}/{total}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-surface-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div>
          {emargements.map((em) => {
            const isSigned = em.est_present && em.signature_data
            const isAbsent = !em.est_present && (em.motif_absence || em.signed_at === null && !locked && false)
            const apprenantName = `${em.apprenant?.prenom || ''} ${em.apprenant?.nom || ''}`.trim()

            return (
              <div
                key={em.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-surface-100/60 last:border-0 transition-colors ${
                  isSigned ? 'bg-emerald-50/40' : !em.est_present && em.motif_absence ? 'bg-rose-50/40' : 'bg-white'
                }`}
              >
                <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                  isSigned ? 'bg-emerald-100' : !em.est_present && em.motif_absence ? 'bg-rose-100' : 'bg-surface-100'
                }`}>
                  {isSigned ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : !em.est_present && em.motif_absence ? (
                    <UserX className="h-5 w-5 text-rose-500" />
                  ) : (
                    <PenLine className="h-5 w-5 text-surface-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-900 truncate">{apprenantName || 'Apprenant'}</div>
                  {isSigned && em.signed_at && (
                    <div className="text-[11px] text-emerald-600 mt-0.5">
                      Signé · {new Date(em.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {!em.est_present && em.motif_absence && (
                    <div className="text-[11px] text-rose-500 mt-0.5 truncate">Absent · {em.motif_absence}</div>
                  )}
                  {!isSigned && !em.motif_absence && (
                    <div className="text-[11px] text-surface-400 mt-0.5">En attente de signature</div>
                  )}
                </div>

                {!locked && (
                  <div className="shrink-0 flex items-center gap-1">
                    {isSigned && em.signature_data ? (
                      <img
                        src={em.signature_data}
                        alt="signature"
                        className="h-10 w-16 object-contain bg-white border border-emerald-200 rounded"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => setSigningFor(em)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-surface-900 text-white hover:bg-surface-800 transition-colors"
                        >
                          <PenLine className="h-3.5 w-3.5" /> Signer
                        </button>
                        <button
                          onClick={() => {
                            setAbsentMotif(em.motif_absence || '')
                            setAbsentingFor(em)
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg border border-surface-200 text-surface-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {locked && isSigned && em.signature_data && (
                  <img
                    src={em.signature_data}
                    alt="signature"
                    className="shrink-0 h-10 w-16 object-contain bg-white border border-emerald-200 rounded"
                  />
                )}
              </div>
            )
          })}

          {/* Formateur self-validation bloc */}
          <div className="px-4 py-4 bg-surface-50 border-t border-surface-200">
            {locked ? (
              <div className="flex items-start gap-3">
                <div className="shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-emerald-700">Feuille validée par le formateur</div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">
                    {feuille?.validated_at && new Date(feuille.validated_at).toLocaleString('fr-FR')}
                  </div>
                </div>
                {feuille?.formateur_signature_data && (
                  <img
                    src={feuille.formateur_signature_data}
                    alt="signature formateur"
                    className="shrink-0 h-12 w-24 object-contain bg-white border border-emerald-200 rounded"
                  />
                )}
              </div>
            ) : (
              <div>
                <div className="text-xs text-surface-500 mb-2">
                  {allSettled
                    ? 'Tous les apprenants sont renseignés. Validez la feuille avec votre signature.'
                    : 'Renseignez chaque apprenant (signature ou absence) avant de valider la feuille.'}
                </div>
                <button
                  onClick={() => setValidateMode(true)}
                  disabled={!allSettled || isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Valider et signer la feuille
                </button>
              </div>
            )}
            {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
          </div>
        </div>
      )}

      {/* SignaturePad apprenant */}
      {signingFor && (
        <SignaturePad
          title="Signature de l'apprenant"
          subtitle={`${signingFor.apprenant?.prenom || ''} ${signingFor.apprenant?.nom || ''}`.trim()}
          isPending={isPending}
          onSign={handleSign}
          onCancel={() => setSigningFor(null)}
          validateLabel="Confirmer la signature"
        />
      )}

      {/* SignaturePad formateur */}
      {validateMode && (
        <SignaturePad
          title="Validation de la feuille"
          subtitle={`${creneauLabel(creneau)} · ${formatFullDate(date)}`}
          isPending={isPending}
          onSign={handleValidate}
          onCancel={() => setValidateMode(false)}
          validateLabel="Verrouiller la feuille"
        />
      )}

      {/* Modal motif absence */}
      {absentingFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-modal w-full max-w-md overflow-hidden animate-slide-up">
            <div className="px-5 pt-5 pb-3">
              <div className="text-base font-heading font-semibold text-surface-900">Marquer absent</div>
              <div className="text-sm text-surface-500 mt-0.5">
                {`${absentingFor.apprenant?.prenom || ''} ${absentingFor.apprenant?.nom || ''}`.trim()}
              </div>
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
                  className="flex-1 px-4 py-3 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAbsent}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
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

function CreateSheetForm({
  token,
  sessionId,
  onSuccess,
}: {
  token: string
  sessionId: string
  onSuccess: () => void
}) {
  const [date, setDate] = useState('')
  const [creneau, setCreneau] = useState<'matin' | 'apres_midi' | 'journee'>('journee')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return
    setError(null)
    startTransition(async () => {
      const result = await createEmargementAction(token, sessionId, date, creneau)
      if (result.success) {
        setDate('')
        onSuccess()
      } else {
        setError(result.error || 'Erreur inconnue')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-surface-50 border-t border-surface-200">
      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
        Créer une feuille d'émargement
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-500">Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="input-base text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-500">Créneau</label>
          <select
            value={creneau}
            onChange={(e) => setCreneau(e.target.value as 'matin' | 'apres_midi' | 'journee')}
            className="input-base text-sm"
          >
            <option value="matin">Matin</option>
            <option value="apres_midi">Après-midi</option>
            <option value="journee">Journée entière</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-500 invisible">Action</label>
          <button
            type="submit"
            disabled={isPending || !date}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer la feuille
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-danger-600 mt-2">{error}</p>}
    </form>
  )
}

function SessionCard({ token, session }: { token: string; session: Session }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  const handleChange = () => router.refresh()
  const handleCreated = () => {
    setShowForm(false)
    router.refresh()
  }

  // Stats : total apprenants signés / nb total émargements
  const allEm = session.dates.flatMap((d) => d.creneaux.flatMap((c) => c.emargements))
  const totalSigned = allEm.filter((e) => e.est_present && e.signature_data).length
  const totalRows = allEm.length

  const validatedFeuilles = session.dates.flatMap((d) => d.creneaux.filter((c) => c.feuille?.validated_at)).length
  const totalFeuilles = session.dates.flatMap((d) => d.creneaux).length

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-4 border-b border-surface-200 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-surface-900 leading-snug">
              {session.formation?.intitule || session.reference}
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {formatShortDate(session.date_debut)} — {formatShortDate(session.date_fin)}
              <span className="ml-2 font-mono">{session.reference}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalRows > 0 && (
              <div className="text-right">
                <div className="text-lg font-heading font-bold text-surface-900">
                  {totalSigned}/{totalRows}
                </div>
                <div className="text-[10px] text-surface-400 leading-none">signatures</div>
              </div>
            )}
            {totalFeuilles > 0 && (
              <div className="text-right">
                <div className="text-lg font-heading font-bold text-emerald-600">
                  {validatedFeuilles}/{totalFeuilles}
                </div>
                <div className="text-[10px] text-surface-400 leading-none">feuilles</div>
              </div>
            )}
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle
            </button>
          </div>
        </div>
      </div>

      {session.dates.length > 0 ? (
        <div>
          {session.dates.map((day) =>
            day.creneaux.map((c) => (
              <CreneauSection
                key={`${day.date}-${c.creneau}`}
                token={token}
                sessionId={session.id}
                date={day.date}
                creneau={c.creneau}
                emargements={c.emargements}
                feuille={c.feuille}
                onChange={handleChange}
              />
            )),
          )}
        </div>
      ) : (
        <div className="px-4 py-10 text-center text-sm text-surface-400">
          <Users className="h-8 w-8 mx-auto mb-2 text-surface-300" />
          Aucune feuille d'émargement. Créez la première.
        </div>
      )}

      {showForm && <CreateSheetForm token={token} sessionId={session.id} onSuccess={handleCreated} />}
    </div>
  )
}

export default function EmargementSheet({ token, sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="card p-12 text-center text-sm text-surface-500">
        <Calendar className="h-8 w-8 mx-auto mb-3 text-surface-300" />
        Aucune session active
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <SessionCard key={session.id} token={token} session={session} />
      ))}
    </div>
  )
}
