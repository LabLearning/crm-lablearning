'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Calendar, AlertCircle, Clock, Euro } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { acceptPoeiInterventionAction, refusePoeiInterventionAction } from '@/app/dashboard/poei/actions'

interface PendingIntervention {
  id: string
  libelle: string
  date_debut: string | null
  date_fin: string | null
  nb_heures: number | null
  montant_ht: number | null
  contexte: string
}

/** Mission POEI proposée au formateur : acceptation → contrat à signer dans la foulée */
export function InterventionPendingCard({ intervention }: { intervention: PendingIntervention }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showRefuse, setShowRefuse] = useState(false)
  const [comment, setComment] = useState('')

  async function handleAccept() {
    setIsLoading(true)
    const r = await acceptPoeiInterventionAction(intervention.id)
    if (r.success) {
      const url = (r.data as any)?.contratSignUrl
      if (url) {
        toast('success', 'Mission acceptée — signez votre contrat de prestation')
        window.location.href = url
        return
      }
      toast('success', 'Mission acceptée')
    } else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  async function handleRefuse() {
    if (!comment.trim()) { toast('error', 'Motif de refus requis'); return }
    setIsLoading(true)
    const r = await refusePoeiInterventionAction(intervention.id, comment)
    if (r.success) { toast('success', 'Mission refusée — le gestionnaire est notifié'); setShowRefuse(false) }
    else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

  return (
    <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Mission POEI à valider</div>
          <div className="text-sm font-bold text-sky-900 mt-0.5">{intervention.libelle}</div>
          <div className="text-xs text-sky-700 mt-0.5">{intervention.contexte}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-sky-800">
        {intervention.date_debut && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Du {fmt(intervention.date_debut)} au {fmt(intervention.date_fin || intervention.date_debut)}
          </div>
        )}
        {intervention.nb_heures ? (
          <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{intervention.nb_heures} h</div>
        ) : null}
        {intervention.montant_ht ? (
          <div className="flex items-center gap-1.5"><Euro className="h-3.5 w-3.5" />{Number(intervention.montant_ht).toLocaleString('fr-FR')} €</div>
        ) : null}
      </div>

      {!showRefuse ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleAccept} isLoading={isLoading} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            J&apos;accepte cette mission
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowRefuse(true)} icon={<XCircle className="h-3.5 w-3.5" />}>
            Refuser
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-2 border-t border-sky-200">
          <label className="block text-xs font-medium text-sky-900 mb-1">Motif du refus *</label>
          <textarea className="input-base text-sm resize-none" rows={2}
            placeholder="Indisponible sur cette période, déjà engagé…"
            value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRefuse} isLoading={isLoading} disabled={!comment.trim()}>Confirmer le refus</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRefuse(false); setComment('') }}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  )
}
