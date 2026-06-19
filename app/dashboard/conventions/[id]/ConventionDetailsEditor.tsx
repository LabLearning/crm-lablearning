'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Save } from 'lucide-react'
import { Select, Input, Button, useToast } from '@/components/ui'
import { FINANCEUR_LABELS } from '@/lib/types/crm'
import { updateConventionDetailsAction } from '../actions'

interface Props {
  conventionId: string
  sessionId: string | null
  financeurType: string | null
  financeurNom: string | null
  sessions: any[]
}

const financeurOptions = [
  { value: '', label: 'Aucun' },
  ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l as string })),
]

export function ConventionDetailsEditor({ conventionId, sessionId, financeurType, financeurNom, sessions }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [sid, setSid] = useState(sessionId || '')
  const [ftype, setFtype] = useState(financeurType || '')
  const [fnom, setFnom] = useState(financeurNom || '')

  const sessionOptions = [
    { value: '', label: 'Aucune' },
    ...sessions.map((s) => {
      const d = s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
      const label = [s.intitule || s.reference || 'Session', d ? `(${d})` : '', s.ville ? `· ${s.ville}` : ''].filter(Boolean).join(' ')
      return { value: s.id, label }
    }),
  ]

  const dirty = (sid || '') !== (sessionId || '') || (ftype || '') !== (financeurType || '') || (fnom || '') !== (financeurNom || '')

  async function save() {
    setSaving(true)
    const result = await updateConventionDetailsAction(conventionId, {
      session_id: sid || null,
      financeur_type: ftype || null,
      financeur_nom: fnom || null,
    })
    setSaving(false)
    if (result.success) {
      toast('success', 'Convention mise à jour')
      router.refresh()
    } else {
      toast('error', result.error || 'Erreur')
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
        <Calendar className="h-3.5 w-3.5" /> Session & financement
      </div>

      <Select
        id="session_id"
        label="Session liée (alimente le planning et les participants du PDF)"
        options={sessionOptions}
        value={sid}
        onChange={(e) => setSid(e.target.value)}
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <Select
          id="financeur_type"
          label="Financeur"
          options={financeurOptions}
          value={ftype}
          onChange={(e) => setFtype(e.target.value)}
        />
        <Input
          id="financeur_nom"
          label="Nom du financeur"
          placeholder="Ex : AKTO"
          value={fnom}
          onChange={(e) => setFnom(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} isLoading={saving} disabled={!dirty} icon={<Save className="h-4 w-4" />}>
          Enregistrer
        </Button>
      </div>
    </div>
  )
}
