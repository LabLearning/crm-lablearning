'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Save, Euro, FilePen } from '@/components/ui/icons'
import { Select, Input, Button, useToast } from '@/components/ui'
import { FINANCEUR_LABELS } from '@/lib/types/crm'
import { updateConventionDetailsAction, updateConventionContenuAction } from '../actions'

interface Props {
  conventionId: string
  sessionId: string | null
  financeurType: string | null
  financeurNom: string | null
  sessions: any[]
  status: string
  montantHt: number | null
  dureeHeures: number | null
  numeroPriseEnCharge: string | null
}

/** Statuts où la convention engage déjà le client : la modification passe par un avenant. */
const CONTRACTUELS = ['envoyee', 'signee_client', 'signee_complete']

const financeurOptions = [
  { value: '', label: 'Aucun' },
  ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l as string })),
]

export function ConventionDetailsEditor({ conventionId, sessionId, financeurType, financeurNom, sessions, status, montantHt, dureeHeures, numeroPriseEnCharge }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const contractuelle = CONTRACTUELS.includes(status)
  const [montant, setMontant] = useState(montantHt != null ? String(montantHt) : '')
  const [duree, setDuree] = useState(dureeHeures != null ? String(dureeHeures) : '')
  const [pec, setPec] = useState(numeroPriseEnCharge || '')
  const [savingContenu, setSavingContenu] = useState(false)
  const dirtyContenu = (montant || '') !== (montantHt != null ? String(montantHt) : '')
    || (duree || '') !== (dureeHeures != null ? String(dureeHeures) : '')
    || (pec || '') !== (numeroPriseEnCharge || '')

  async function saveContenu() {
    setSavingContenu(true)
    const r = await updateConventionContenuAction(conventionId, {
      montant_ht: montant.trim() === '' ? null : Number(montant.replace(',', '.')),
      duree_heures: duree.trim() === '' ? null : Number(duree.replace(',', '.')),
      numero_prise_en_charge: pec.trim() || null,
    })
    setSavingContenu(false)
    if (r.success) {
      toast('success', r.data?.avenant ? `Convention mise à jour, avenant n°${r.data.avenant} créé` : 'Convention mise à jour')
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }
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
    <div className="space-y-4">
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
        <Euro className="h-3.5 w-3.5" /> Prix, durée et prise en charge
      </div>
      <p className="text-xs text-surface-500 -mt-2">
        {contractuelle
          ? 'La convention a été envoyée ou signée : la modification est appliquée au document et un avenant numéroté en garde la trace. Aucune nouvelle signature à demander ; l\u2019avenant peut être transmis au client si le financeur le demande.'
          : 'La convention est encore en brouillon : la modification est directe.'}
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <Input id="montant_ht" label="Prix HT (€)" type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
        <Input id="duree_heures" label="Durée (heures)" type="number" step="0.5" min="0" value={duree} onChange={(e) => setDuree(e.target.value)} />
        <Input id="numero_pec" label="Numéro de prise en charge" placeholder="Ex : 2608AF031079" value={pec} onChange={(e) => setPec(e.target.value)} />
      </div>
      <p className="text-xs text-surface-500">
        Les participants et les dates se modifient sur la session liée : la convention les reprend automatiquement, avec un avenant si elle est déjà signée.
      </p>
      <div className="flex justify-end">
        <Button onClick={saveContenu} isLoading={savingContenu} disabled={!dirtyContenu} icon={contractuelle ? <FilePen className="h-4 w-4" /> : <Save className="h-4 w-4" />}>
          {contractuelle ? 'Mettre à jour et créer l\u2019avenant' : 'Enregistrer'}
        </Button>
      </div>
    </div>

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
    </div>
  )
}
