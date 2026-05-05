'use client'

import { useState } from 'react'
import { Send, CheckCircle2, XCircle, Clock, ShieldCheck, AlertCircle, FileText } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { submitLeadForValidationAction, approveLeadAction, rejectLeadAction } from './actions'
import { formatDateTime } from '@/lib/utils'
import type { Lead } from '@/lib/types/crm'

interface LeadValidationCardProps {
  lead: Lead
  currentUserRole: string
  currentUserId: string
  /** Liste des gestionnaires (pour le dropdown d'assignation à la validation) */
  gestionnaires: Array<{ id: string; first_name: string | null; last_name: string | null }>
  onAfterAction?: () => void
}

export function LeadValidationCard({ lead, currentUserRole, currentUserId, gestionnaires, onAfterAction }: LeadValidationCardProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [selectedGestionnaire, setSelectedGestionnaire] = useState(gestionnaires[0]?.id || '')
  const [comment, setComment] = useState('')

  const isDirector = ['directeur_commercial', 'super_admin'].includes(currentUserRole)
  const isAuthor = lead.submitted_by === currentUserId || lead.assigned_to === currentUserId
  const status = lead.validation_status || 'draft'

  async function handleSubmit() {
    setIsLoading(true)
    const r = await submitLeadForValidationAction(lead.id)
    if (r.success) { toast('success', 'Lead soumis au directeur commercial'); onAfterAction?.() }
    else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  async function handleApprove() {
    if (!selectedGestionnaire) { toast('error', 'Sélectionne un gestionnaire'); return }
    setIsLoading(true)
    const r = await approveLeadAction(lead.id, selectedGestionnaire, comment || undefined)
    if (r.success) {
      toast('success', 'Lead validé et assigné')
      setShowApproveForm(false); setComment('')
      onAfterAction?.()
    } else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  async function handleReject() {
    if (!comment.trim()) { toast('error', 'Commentaire de refus requis'); return }
    setIsLoading(true)
    const r = await rejectLeadAction(lead.id, comment)
    if (r.success) {
      toast('success', 'Lead refusé')
      setShowRejectForm(false); setComment('')
      onAfterAction?.()
    } else toast('error', r.error || 'Erreur')
    setIsLoading(false)
  }

  // ── Render selon le statut ──

  if (status === 'draft') {
    if (!isAuthor) return null
    return (
      <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 flex items-center gap-3">
        <FileText className="h-4 w-4 text-surface-400 shrink-0" />
        <div className="flex-1 text-sm text-surface-600">Brouillon — non soumis pour validation</div>
        <Button size="sm" onClick={handleSubmit} isLoading={isLoading} icon={<Send className="h-3.5 w-3.5" />}>
          Soumettre au directeur commercial
        </Button>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-3">
        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-900">En attente de validation</div>
            {lead.submitted_at && (
              <div className="text-xs text-amber-700 mt-0.5">
                Soumis le {formatDateTime(lead.submitted_at)}
                {lead.submitted_user && ` par ${lead.submitted_user.first_name} ${lead.submitted_user.last_name}`}
              </div>
            )}
          </div>
        </div>

        {isDirector && !showApproveForm && !showRejectForm && (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => setShowApproveForm(true)} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
              Valider
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRejectForm(true)} icon={<XCircle className="h-3.5 w-3.5" />}>
              Refuser
            </Button>
          </div>
        )}

        {isDirector && showApproveForm && (
          <div className="space-y-2 pt-2 border-t border-amber-200">
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Assigner à un gestionnaire *</label>
              <select className="input-base text-sm" value={selectedGestionnaire} onChange={e => setSelectedGestionnaire(e.target.value)}>
                {gestionnaires.length === 0 && <option value="">— Aucun gestionnaire disponible —</option>}
                {gestionnaires.map(g => (
                  <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Commentaire (optionnel)</label>
              <textarea
                className="input-base text-sm resize-none"
                rows={2}
                placeholder="Précisions pour le gestionnaire…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApprove} isLoading={isLoading} disabled={!selectedGestionnaire}>Valider et assigner</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowApproveForm(false); setComment('') }}>Annuler</Button>
            </div>
          </div>
        )}

        {isDirector && showRejectForm && (
          <div className="space-y-2 pt-2 border-t border-amber-200">
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Motif du refus *</label>
              <textarea
                className="input-base text-sm resize-none"
                rows={2}
                placeholder="Explique pourquoi tu refuses…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleReject} isLoading={isLoading} disabled={!comment.trim()}>Refuser</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowRejectForm(false); setComment('') }}>Annuler</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 space-y-1">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-emerald-900">Lead validé</div>
            {lead.validated_at && (
              <div className="text-xs text-emerald-700 mt-0.5">
                Le {formatDateTime(lead.validated_at)}
                {lead.validated_user && ` par ${lead.validated_user.first_name} ${lead.validated_user.last_name}`}
              </div>
            )}
            {lead.gestionnaire && (
              <div className="text-xs text-emerald-700">
                Gestionnaire : <strong>{lead.gestionnaire.first_name} {lead.gestionnaire.last_name}</strong>
              </div>
            )}
            {lead.validation_comment && (
              <div className="text-xs text-emerald-800 mt-1.5 italic">« {lead.validation_comment} »</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-red-900">Lead refusé</div>
            {lead.validated_at && (
              <div className="text-xs text-red-700 mt-0.5">
                Le {formatDateTime(lead.validated_at)}
                {lead.validated_user && ` par ${lead.validated_user.first_name} ${lead.validated_user.last_name}`}
              </div>
            )}
            {lead.validation_comment && (
              <div className="text-xs text-red-800 mt-1.5 italic">« {lead.validation_comment} »</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
