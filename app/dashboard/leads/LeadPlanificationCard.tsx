'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, CalendarClock, Presentation, ArrowRight } from 'lucide-react'
import { Button, Badge, Select, useToast } from '@/components/ui'
import { confirmLeadDateAction, proposeLeadDateAction } from './actions'
import { formatDate } from '@/lib/utils'
import type { Lead } from '@/lib/types/crm'

interface Formateur { id: string; prenom: string; nom: string }

const MANAGER_ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial']

const PLANIF_LABELS: Record<string, string> = {
  a_planifier: 'À planifier',
  date_confirmee: 'Date confirmée',
  autre_date_proposee: 'Autre date proposée',
}
const PLANIF_VARIANTS: Record<string, 'default' | 'success' | 'warning'> = {
  a_planifier: 'warning',
  date_confirmee: 'success',
  autre_date_proposee: 'default',
}

export function LeadPlanificationCard({ lead, formateurs, currentUserRole }: {
  lead: Lead
  formateurs: Formateur[]
  currentUserRole: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [date, setDate] = useState(lead.date_confirmee || lead.date_souhaitee || '')
  const [formateurId, setFormateurId] = useState(lead.formateur_id || '')
  const [busy, setBusy] = useState<'confirm' | 'propose' | null>(null)

  const isManager = MANAGER_ROLES.includes(currentUserRole)
  const status = lead.planification_status || 'a_planifier'
  const confirmed = status === 'date_confirmee' && !!lead.session_id

  async function confirm() {
    if (!date) { toast('error', 'Choisissez une date'); return }
    if (!formateurId) { toast('error', 'Choisissez un formateur'); return }
    setBusy('confirm')
    const fd = new FormData()
    fd.set('date', date)
    fd.set('formateur_id', formateurId)
    const res = await confirmLeadDateAction(lead.id, fd)
    if (res.success) { toast('success', 'Date confirmée — session créée'); router.refresh() }
    else toast('error', res.error || 'Erreur')
    setBusy(null)
  }

  async function propose() {
    if (!date) { toast('error', 'Choisissez une date'); return }
    setBusy('propose')
    const fd = new FormData()
    fd.set('date', date)
    const res = await proposeLeadDateAction(lead.id, fd)
    if (res.success) { toast('success', 'Autre date proposée'); router.refresh() }
    else toast('error', res.error || 'Erreur')
    setBusy(null)
  }

  const formateurOptions = [
    { value: '', label: '— Choisir un formateur —' },
    ...formateurs.map((f) => ({ value: f.id, label: `${f.prenom} ${f.nom}` })),
  ]

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-brand-500 shrink-0" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Planification</span>
        </div>
        <Badge variant={PLANIF_VARIANTS[status] || 'default'}>{PLANIF_LABELS[status] || status}</Badge>
      </div>

      {/* Récap formation / date souhaitée */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] text-surface-400 uppercase tracking-wider">Formation</div>
          <div className="text-surface-800 truncate">{lead.formation_souhaitee || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] text-surface-400 uppercase tracking-wider">Date souhaitée</div>
          <div className="text-surface-800">{lead.date_souhaitee ? formatDate(lead.date_souhaitee, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
        </div>
      </div>

      {confirmed ? (
        <div className="rounded-xl bg-success-50/60 border border-success-100 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-success-700">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            Confirmée le {lead.date_confirmee ? formatDate(lead.date_confirmee, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </div>
          {lead.session_id && (
            <a href="/dashboard/sessions" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
              <Presentation className="h-3.5 w-3.5" /> Session créée — voir les sessions <ArrowRight className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : !lead.formation_id ? (
        <p className="text-xs text-surface-500 rounded-lg bg-surface-50 px-3 py-2">
          Associez une <strong>formation</strong> au lead (via Modifier) pour pouvoir confirmer une date et créer la session.
        </p>
      ) : !isManager ? (
        <p className="text-xs text-surface-500">
          {status === 'autre_date_proposee'
            ? `Une autre date a été proposée${lead.date_confirmee ? ` : le ${formatDate(lead.date_confirmee, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.`
            : 'En attente de confirmation par un gestionnaire.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Date de session</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base w-full" />
            </div>
            <Select label="Formateur désigné" options={formateurOptions} value={formateurId} onChange={(e) => setFormateurId(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={confirm} isLoading={busy === 'confirm'} icon={<CalendarCheck className="h-3.5 w-3.5" />}>
              Confirmer &amp; créer la session
            </Button>
            <Button size="sm" variant="secondary" onClick={propose} isLoading={busy === 'propose'} icon={<CalendarClock className="h-3.5 w-3.5" />}>
              Proposer une autre date
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
