'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, CheckSquare, Clock, PenTool } from '@/components/ui/icons'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui'
import { SignaturePad } from '../emargement/SignaturePad'
import { signerMaJourneeAction } from './actions'

const CRENEAU: Record<string, string> = { matin: 'Matin', apres_midi: 'Après-midi', journee: 'Journée' }

interface Creneau {
  creneau: string
  est_present: boolean | null
  motif_absence: string | null
  signe: boolean
}

interface Jour {
  date: string
  creneaux: Creneau[]
  signable: boolean
}

interface GroupeSession {
  sessionId: string
  titre: string
  jours: Jour[]
}

/**
 * Émargements par JOURNÉE : une signature remplit les créneaux du jour
 * (matin + après-midi) — beaucoup plus simple pour le stagiaire, et la
 * feuille conserve une signature par demi-journée.
 */
export function MesEmargementsClient({ token, groupes }: { token: string; groupes: GroupeSession[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [signature, setSignature] = useState<{ sessionId: string; date: string; libelle: string } | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function signer(base64: string) {
    if (!signature) return
    setEnCours(true)
    const r = await signerMaJourneeAction(token, signature.sessionId, signature.date, base64)
    setEnCours(false)
    if (r.success) { toast('success', 'Journée signée, merci !'); setSignature(null); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  function EtatCreneau({ c }: { c: Creneau }) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-surface-500">{CRENEAU[c.creneau] || c.creneau}</span>
        {c.signe
          ? <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Signé</span>
          : c.est_present === false && c.motif_absence
          ? <span className="inline-flex items-center gap-0.5 font-medium text-surface-400"><XCircle className="h-3.5 w-3.5" /> Absent · {c.motif_absence}</span>
          : <span className="inline-flex items-center gap-0.5 font-medium text-amber-600"><Clock className="h-3.5 w-3.5" /> À signer</span>}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-heading font-bold text-surface-900">Mes émargements</h1>
        <p className="text-sm text-surface-500 mt-1">
          Une signature par journée de formation : elle vaut pour le matin et l&apos;après-midi.
        </p>
      </div>

      {groupes.length === 0 && (
        <div className="card p-10 text-center text-sm text-surface-500">Aucun émargement pour le moment.</div>
      )}

      {groupes.map((g) => {
        const total = g.jours.length
        const signes = g.jours.filter((j) => j.creneaux.every((c) => c.signe || (c.est_present === false && !!c.motif_absence))).length
        return (
          <div key={g.sessionId} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-3">
              <CheckSquare className="h-4 w-4 text-brand-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-heading font-semibold text-surface-900 truncate">{g.titre}</div>
              </div>
              <span className={`text-xs font-semibold tabular-nums shrink-0 ${signes === total ? 'text-emerald-600' : 'text-amber-600'}`}>
                {signes}/{total} jour{total > 1 ? 's' : ''} signé{signes > 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y divide-surface-50">
              {g.jours.map((j) => (
                <div key={j.date} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-sm font-medium text-surface-900">
                      {formatDate(j.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {j.creneaux.map((c) => <EtatCreneau key={c.creneau} c={c} />)}
                    </div>
                  </div>
                  {j.signable && (
                    <button
                      onClick={() => setSignature({
                        sessionId: g.sessionId,
                        date: j.date,
                        libelle: `${formatDate(j.date, { weekday: 'long', day: 'numeric', month: 'long' })} — journée complète`,
                      })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors shrink-0"
                    >
                      <PenTool className="h-3.5 w-3.5" /> Signer la journée
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {signature && (
        <SignaturePad
          title="Signer ma journée"
          subtitle={signature.libelle}
          onSign={signer}
          onCancel={() => setSignature(null)}
          isPending={enCours}
        />
      )}
    </div>
  )
}
