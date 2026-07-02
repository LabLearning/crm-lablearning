'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Mail, Phone, Euro, Calendar, Tag,
  MessageSquare, ArrowRight, Send, Calculator,
  ClipboardList, Mails, Zap,
} from 'lucide-react'
import { Button, Badge, Select, useToast } from '@/components/ui'
import { addInteractionAction } from './actions'
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS,
  INTERACTION_LABELS, PIPELINE_COLUMNS,
} from '@/lib/types/crm'
import { formatDateTime } from '@/lib/utils'
import type { Lead, LeadStatus, LeadInteraction } from '@/lib/types/crm'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { LeadValidationCard } from './LeadValidationCard'
import { LeadPlanificationCard } from './LeadPlanificationCard'

interface LeadDetailProps {
  lead: Lead
  users: Pick<User, 'id' | 'first_name' | 'last_name' | 'role'>[]
  gestionnaires: Pick<User, 'id' | 'first_name' | 'last_name'>[]
  formateurs?: { id: string; prenom: string; nom: string }[]
  currentUserRole: string
  currentUserId: string
  onStatusChange: (status: LeadStatus) => void
  onClose: () => void
  interactions?: LeadInteraction[]
}

const interactionOptions = Object.entries(INTERACTION_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function LeadDetail({ lead, users, gestionnaires, formateurs = [], currentUserRole, currentUserId, onStatusChange, onClose, interactions = [] }: LeadDetailProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [addingInteraction, setAddingInteraction] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [tab, setTab] = useState<'info' | 'historique' | 'actions'>('info')

  const currentIndex = PIPELINE_COLUMNS.indexOf(lead.status)
  const nextStatus = currentIndex < PIPELINE_COLUMNS.length - 2 ? PIPELINE_COLUMNS[currentIndex + 1] : null

  async function handleAddInteraction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    formData.set('lead_id', lead.id)
    const result = await addInteractionAction(formData)
    if (result.success) { toast('success', 'Interaction ajoutee'); setAddingInteraction(false); (e.target as HTMLFormElement).reset() }
    else toast('error', result.error || 'Erreur')
    setIsSaving(false)
  }

  // ── Prefill & navigate functions ──

  function prefillEmail() {
    const data = {
      civilite: '', nom: lead.contact_nom, prenom: lead.contact_prenom || '',
      email: lead.contact_email || '', telephone: lead.contact_telephone || '',
      etablissement: lead.entreprise || '', ville: '', siret: lead.siret || '',
    }
    localStorage.setItem('ll_prefill_email', JSON.stringify(data))
    router.push('/dashboard/prospection')
  }

  function prefillSimulateur() {
    const data = {
      etabNom: lead.entreprise || '', effectif: lead.nombre_stagiaires || '',
      clientName: (lead.contact_prenom || '') + ' ' + lead.contact_nom,
      clientEmail: lead.contact_email || '',
    }
    localStorage.setItem('ll_prefill_simu', JSON.stringify(data))
    router.push('/dashboard/simulateur')
  }

  function prefillAudit() {
    const data = {
      etabNom: lead.entreprise || '', effectif: lead.nombre_stagiaires || '',
      contactNom: (lead.contact_prenom || '') + ' ' + lead.contact_nom,
      contactEmail: lead.contact_email || '', contactTel: lead.contact_telephone || '',
    }
    localStorage.setItem('ll_prefill_audit', JSON.stringify(data))
    router.push('/dashboard/audit')
  }

  function prefillMailing() {
    const data = {
      destinataire: lead.contact_email || '',
      nom: (lead.contact_prenom || '') + ' ' + lead.contact_nom,
      etablissement: lead.entreprise || '',
    }
    localStorage.setItem('ll_prefill_mailing', JSON.stringify(data))
    router.push('/dashboard/mailing')
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Workflow validation */}
      <LeadValidationCard
        lead={lead}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        gestionnaires={gestionnaires}
      />

      {/* Planification : confirmation de date + création de session */}
      <LeadPlanificationCard
        lead={lead}
        formateurs={formateurs}
        currentUserRole={currentUserRole}
      />

      {/* Status progression */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {PIPELINE_COLUMNS.filter(s => s !== 'perdu').map((status, i) => {
          const isActive = status === lead.status
          const isPast = PIPELINE_COLUMNS.indexOf(status) < currentIndex
          return (
            <button key={status} onClick={() => onStatusChange(status)}
              className={cn('flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                isActive ? 'bg-brand-100 text-brand-700' : isPast ? 'bg-success-50 text-success-700' : 'bg-surface-100 text-surface-500 hover:bg-surface-200')}>
              {LEAD_STATUS_LABELS[status]}
              {i < PIPELINE_COLUMNS.length - 2 && <ArrowRight className="h-3 w-3 text-surface-300 ml-1" />}
            </button>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-lg p-0.5">
        {([
          { id: 'info' as const, label: 'Infos' },
          { id: 'actions' as const, label: 'Actions rapides' },
          { id: 'historique' as const, label: 'Historique' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              tab === t.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB INFO ── */}
      {tab === 'info' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {lead.entreprise && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50">
                <Building2 className="h-4 w-4 text-surface-400" />
                <div><div className="text-[10px] text-surface-400">Entreprise</div><div className="text-sm font-medium text-surface-800">{lead.entreprise}</div></div>
              </div>
            )}
            {lead.contact_email && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50">
                <Mail className="h-4 w-4 text-surface-400" />
                <div><div className="text-[10px] text-surface-400">Email</div><div className="text-sm text-surface-800 truncate">{lead.contact_email}</div></div>
              </div>
            )}
            {lead.contact_telephone && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50">
                <Phone className="h-4 w-4 text-surface-400" />
                <div><div className="text-[10px] text-surface-400">Telephone</div><div className="text-sm text-surface-800">{lead.contact_telephone}</div></div>
              </div>
            )}
            {lead.montant_estime && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50">
                <Euro className="h-4 w-4 text-surface-400" />
                <div><div className="text-[10px] text-surface-400">Montant estime</div><div className="text-sm font-medium text-surface-800">{Number(lead.montant_estime).toLocaleString('fr-FR')} EUR</div></div>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50">
              <Tag className="h-4 w-4 text-surface-400" />
              <div><div className="text-[10px] text-surface-400">Source</div><div className="text-sm text-surface-800">{LEAD_SOURCE_LABELS[lead.source]}</div></div>
            </div>
            {lead.formation_souhaitee && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50">
                <Calendar className="h-4 w-4 text-surface-400" />
                <div><div className="text-[10px] text-surface-400">Formation souhaitee</div><div className="text-sm text-surface-800 truncate">{lead.formation_souhaitee}</div></div>
              </div>
            )}
          </div>
          {lead.commentaire && (
            <div className="p-3 rounded-xl bg-surface-50">
              <div className="text-[10px] text-surface-400 mb-1">Commentaire</div>
              <div className="text-sm text-surface-700 whitespace-pre-wrap">{lead.commentaire}</div>
            </div>
          )}
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map(t => <Badge key={t} variant="default">{t}</Badge>)}
            </div>
          )}
        </div>
      )}

      {/* ── TAB ACTIONS RAPIDES ── */}
      {tab === 'actions' && (
        <div className="space-y-3">
          <div className="text-xs text-surface-500 mb-1">Lancer une action avec les infos de ce lead pre-remplies :</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={prefillEmail}
              className="flex items-center gap-3 p-4 rounded-xl border border-surface-200 hover:shadow-card hover:border-emerald-200 transition-all text-left group">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100">
                <Send className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-surface-900">Prospection email</div>
                <div className="text-xs text-surface-500">Email pre-rempli</div>
              </div>
            </button>

            <button onClick={prefillSimulateur}
              className="flex items-center gap-3 p-4 rounded-xl border border-surface-200 hover:shadow-card hover:border-violet-200 transition-all text-left group">
              <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100">
                <Calculator className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-surface-900">Simuler budget</div>
                <div className="text-xs text-surface-500">Simulateur OPCO</div>
              </div>
            </button>

            <button onClick={prefillAudit}
              className="flex items-center gap-3 p-4 rounded-xl border border-surface-200 hover:shadow-card hover:border-amber-200 transition-all text-left group">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-surface-900">Lancer un audit</div>
                <div className="text-xs text-surface-500">Audit conformite</div>
              </div>
            </button>

            <button onClick={prefillMailing}
              className="flex items-center gap-3 p-4 rounded-xl border border-surface-200 hover:shadow-card hover:border-rose-200 transition-all text-left group">
              <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100">
                <Mails className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-surface-900">Mailing rapide</div>
                <div className="text-xs text-surface-500">Email avec template</div>
              </div>
            </button>
          </div>

          {/* Direct actions */}
          <div className="flex gap-2 pt-2">
            {lead.contact_telephone && (
              <a href={'tel:' + lead.contact_telephone}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                <Phone className="h-4 w-4" /> Appeler
              </a>
            )}
            {lead.contact_email && (
              <a href={'mailto:' + lead.contact_email}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-100 text-surface-700 text-sm font-medium">
                <Mail className="h-4 w-4" /> Email direct
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── TAB HISTORIQUE ── */}
      {tab === 'historique' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-800">Historique</h3>
            <Button size="sm" variant="secondary" onClick={() => setAddingInteraction(!addingInteraction)} icon={<MessageSquare className="h-3.5 w-3.5" />}>Ajouter</Button>
          </div>
          {addingInteraction && (
            <form onSubmit={handleAddInteraction} className="card p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select id="interaction-type" name="type" label="Type" options={interactionOptions} defaultValue="note" />
                <input name="subject" placeholder="Objet (optionnel)" className="input-base mt-auto" />
              </div>
              <textarea name="content" rows={3} className="input-base resize-none" placeholder="Details..." required />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => setAddingInteraction(false)}>Annuler</Button>
                <Button size="sm" type="submit" isLoading={isSaving} icon={<Send className="h-3.5 w-3.5" />}>Enregistrer</Button>
              </div>
            </form>
          )}
          {interactions.length > 0 ? (
            <div className="space-y-3">
              {interactions.map(interaction => (
                <div key={interaction.id} className="flex gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="shrink-0 mt-0.5"><Badge variant="default">{INTERACTION_LABELS[interaction.type]}</Badge></div>
                  <div className="min-w-0 flex-1">
                    {interaction.subject && <div className="text-sm font-medium text-surface-800">{interaction.subject}</div>}
                    <div className="text-sm text-surface-600 whitespace-pre-wrap">{interaction.content}</div>
                    <div className="text-[10px] text-surface-400 mt-1">
                      {interaction.user && (interaction.user as any).first_name + ' ' + (interaction.user as any).last_name + ' -- '}
                      {formatDateTime(interaction.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-surface-400">Aucune interaction</div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      {nextStatus && lead.status !== 'gagne' && lead.status !== 'perdu' && (
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
          <Button variant="secondary" size="sm" onClick={() => onStatusChange('perdu')}>Marquer perdu</Button>
          <Button size="sm" onClick={() => onStatusChange(nextStatus)} icon={<ArrowRight className="h-4 w-4" />}>
            Passer a &laquo; {LEAD_STATUS_LABELS[nextStatus]} &raquo;
          </Button>
        </div>
      )}
    </div>
  )
}
