'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Calendar, MapPin, AlertCircle, Clock } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { acceptMissionAction, refuseMissionAction } from '@/app/dashboard/sessions/actions'

interface PendingMission {
  id: string
  reference: string | null
  date_debut: string
  date_fin: string
  lieu: string | null
  horaires: string | null
  formation_intitule: string
  proposed_at: string | null
  proposed_by_name: string | null
}

export function MissionPendingCard({ mission }: { mission: PendingMission }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [comment, setComment] = useState('')

  async function handleAccept() {
    setIsLoading(true)
    const r = await acceptMissionAction(mission.id)
    if (r.success) {
      const signUrl = (r.data as any)?.contratSignUrl
      if (signUrl) {
        toast('success', 'Mission acceptée — signez votre contrat de prestation')
        window.location.href = signUrl
        return
      }
      toast('success', 'Mission acceptée — le gestionnaire est notifié')
    } else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  async function handleRefuse() {
    if (!comment.trim()) { toast('error', 'Motif de refus requis'); return }
    setIsLoading(true)
    const r = await refuseMissionAction(mission.id, comment)
    if (r.success) {
      toast('success', 'Mission refusée — le gestionnaire est notifié')
      setShowRefuseForm(false); setComment('')
    } else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Nouvelle mission à valider</div>
          <div className="text-sm font-bold text-amber-900 mt-0.5">{mission.formation_intitule}</div>
          {mission.proposed_by_name && (
            <div className="text-xs text-amber-700 mt-0.5">Proposée par {mission.proposed_by_name}</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-amber-800">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Du {new Date(mission.date_debut).toLocaleDateString('fr-FR')} au {new Date(mission.date_fin).toLocaleDateString('fr-FR')}
        </div>
        {mission.horaires && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {mission.horaires}
          </div>
        )}
        {mission.lieu && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {mission.lieu}
          </div>
        )}
        {mission.reference && (
          <div className="flex items-center gap-1.5 text-amber-600 font-mono">{mission.reference}</div>
        )}
      </div>

      {!showRefuseForm ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleAccept} isLoading={isLoading} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            J'accepte cette mission
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowRefuseForm(true)} icon={<XCircle className="h-3.5 w-3.5" />}>
            Refuser
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-2 border-t border-amber-200">
          <div>
            <label className="block text-xs font-medium text-amber-900 mb-1">Motif du refus *</label>
            <textarea
              className="input-base text-sm resize-none"
              rows={2}
              placeholder="Indisponible cette semaine, déjà engagé sur une autre mission..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleRefuse} isLoading={isLoading} disabled={!comment.trim()}>Confirmer le refus</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRefuseForm(false); setComment('') }}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  )
}
