'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Trash2, Loader2, Mail, Phone, Pencil } from 'lucide-react'
import { Button, Input, Select, useToast } from '@/components/ui'
import { getLeadParticipantsAction, addLeadParticipantAction, updateLeadParticipantAction, deleteLeadParticipantAction } from './actions'

interface Participant {
  id: string; civilite: string | null; prenom: string | null; nom: string
  email: string | null; telephone: string | null; poste: string | null
  date_naissance: string | null; lieu_naissance: string | null
  adresse: string | null; code_postal: string | null; ville: string | null
  type_contrat: string | null
  numero_securite_sociale: string | null; niveau_diplome: string | null
}

const CONTRAT_OPTIONS = [
  { value: '', label: 'Type de contrat' },
  { value: 'Dirigeant', label: 'Dirigeant' },
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Intérim', label: 'Intérim' },
  { value: 'Alternance', label: 'Alternance / Apprentissage' },
  { value: 'Stage', label: 'Stage' },
  { value: "Demandeur d'emploi", label: "Demandeur d'emploi" },
  { value: 'Autre', label: 'Autre' },
]
const NIVEAU_OPTIONS = [
  { value: '', label: 'Niveau de diplôme' },
  { value: 'Sans diplôme', label: 'Sans diplôme' },
  { value: 'Niveau 3 (CAP/BEP)', label: 'Niveau 3 (CAP/BEP)' },
  { value: 'Niveau 4 (Bac)', label: 'Niveau 4 (Bac)' },
  { value: 'Niveau 5 (Bac+2)', label: 'Niveau 5 (Bac+2)' },
  { value: 'Niveau 6 (Licence)', label: 'Niveau 6 (Licence)' },
  { value: 'Niveau 7 (Master)', label: 'Niveau 7 (Master)' },
  { value: 'Niveau 8 (Doctorat)', label: 'Niveau 8 (Doctorat)' },
]

// Formulaire partagé (ajout + édition) — pré-rempli si un participant est fourni
function ParticipantForm({ participant, busy, onSubmit, onCancel }: {
  participant?: Participant
  busy: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const p = participant
  return (
    <form onSubmit={onSubmit} className="space-y-2.5 rounded-xl bg-surface-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input name="prenom" placeholder="Prénom" defaultValue={p?.prenom || ''} />
        <Input name="nom" placeholder="Nom *" defaultValue={p?.nom || ''} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input name="email" type="email" placeholder="Email" defaultValue={p?.email || ''} />
        <Input name="telephone" placeholder="Téléphone" defaultValue={p?.telephone || ''} />
      </div>
      {/* État civil — exigé dans les dossiers de prise en charge */}
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <label className="block text-2xs text-surface-400 mb-0.5">Date de naissance</label>
          <Input name="date_naissance" type="date" defaultValue={p?.date_naissance || ''} />
        </div>
        <div>
          <label className="block text-2xs text-surface-400 mb-0.5">Lieu de naissance</label>
          <Input name="lieu_naissance" placeholder="Ville de naissance" defaultValue={p?.lieu_naissance || ''} />
        </div>
      </div>
      <Input name="numero_securite_sociale" placeholder="N° de sécurité sociale" defaultValue={p?.numero_securite_sociale || ''} />
      <Input name="adresse" placeholder="Adresse" defaultValue={p?.adresse || ''} />
      <div className="grid grid-cols-3 gap-2">
        <Input name="code_postal" placeholder="Code postal" defaultValue={p?.code_postal || ''} />
        <div className="col-span-2">
          <Input name="ville" placeholder="Ville" defaultValue={p?.ville || ''} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select name="type_contrat" options={CONTRAT_OPTIONS} defaultValue={p?.type_contrat || ''} />
        <Select name="niveau_diplome" options={NIVEAU_OPTIONS} defaultValue={p?.niveau_diplome || ''} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" size="sm" isLoading={busy}>{participant ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </form>
  )
}

export function LeadParticipantsCard({ leadId, nombreStagiaires }: { leadId: string; nombreStagiaires: number | null }) {
  const { toast } = useToast()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getLeadParticipantsAction(leadId).then((res) => {
      if (active && res.success) setParticipants((res.data as Participant[]) || [])
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [leadId])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const form = e.currentTarget
    const res = await addLeadParticipantAction(leadId, new FormData(form))
    if (res.success && res.data) {
      setParticipants((p) => [...p, res.data as Participant])
      setShowForm(false)
      toast('success', 'Participant ajouté')
    } else {
      toast('error', res.error || 'Erreur')
    }
    setBusy(false)
  }

  async function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const res = await updateLeadParticipantAction(id, new FormData(e.currentTarget))
    if (res.success && res.data) {
      setParticipants((list) => list.map((x) => x.id === id ? (res.data as Participant) : x))
      setEditingId(null)
      toast('success', 'Participant mis à jour')
    } else {
      toast('error', res.error || 'Erreur')
    }
    setBusy(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Retirer ce participant ?')) return
    const res = await deleteLeadParticipantAction(id)
    if (res.success) { setParticipants((p) => p.filter((x) => x.id !== id)); setEditingId(null) }
    else toast('error', res.error || 'Erreur')
  }

  const target = nombreStagiaires || 0

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-500 shrink-0" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Participants prévus{' '}
            <span className="text-surface-400">
              ({participants.length}{target ? `/${target}` : ''})
            </span>
          </span>
        </div>
        {!showForm && (
          <Button size="sm" variant="secondary" onClick={() => { setShowForm(true); setEditingId(null) }} icon={<UserPlus className="h-3.5 w-3.5" />}>
            Ajouter
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-surface-400 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : (
        <>
          {participants.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {participants.map((p) => (
                editingId === p.id ? (
                  <div key={p.id} className="py-2">
                    <ParticipantForm participant={p} busy={busy} onSubmit={(e) => handleUpdate(p.id, e)} onCancel={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div key={p.id} className="flex items-center gap-3 py-2 group">
                    <button
                      onClick={() => { setEditingId(p.id); setShowForm(false) }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 text-2xs font-semibold text-surface-500">
                        {(p.prenom?.[0] || '') + (p.nom?.[0] || '')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate group-hover:text-brand-600 transition-colors">
                          {[p.civilite, p.prenom, p.nom].filter(Boolean).join(' ')}
                          {p.poste && <span className="text-surface-400 font-normal"> · {p.poste}</span>}
                        </div>
                        <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
                          {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                          {p.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telephone}</span>}
                          {p.type_contrat && <span>{p.type_contrat}</span>}
                          {p.niveau_diplome && <span>{p.niveau_diplome}</span>}
                          {p.date_naissance && <span>né(e) le {new Date(p.date_naissance).toLocaleDateString('fr-FR')}</span>}
                        </div>
                      </div>
                    </button>
                    <button onClick={() => setEditingId(p.id)} className="text-surface-300 hover:text-brand-600 transition-colors shrink-0" title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-surface-300 hover:text-danger-600 transition-colors shrink-0" title="Retirer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              ))}
            </div>
          ) : (
            !showForm && <p className="text-xs text-surface-400">Aucun participant saisi. Ces personnes deviendront apprenants à la signature de la convention.</p>
          )}

          {showForm && (
            <ParticipantForm busy={busy} onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
          )}
        </>
      )}
    </div>
  )
}
