'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Trash2, Loader2, Mail, Phone } from 'lucide-react'
import { Button, Input, useToast } from '@/components/ui'
import { getLeadParticipantsAction, addLeadParticipantAction, deleteLeadParticipantAction } from './actions'

interface Participant {
  id: string; civilite: string | null; prenom: string | null; nom: string
  email: string | null; telephone: string | null; poste: string | null
}

export function LeadParticipantsCard({ leadId, nombreStagiaires }: { leadId: string; nombreStagiaires: number | null }) {
  const { toast } = useToast()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

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
    setAdding(true)
    const form = e.currentTarget
    const res = await addLeadParticipantAction(leadId, new FormData(form))
    if (res.success && res.data) {
      setParticipants((p) => [...p, res.data as Participant])
      form.reset()
      setShowForm(false)
      toast('success', 'Participant ajouté')
    } else {
      toast('error', res.error || 'Erreur')
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    const res = await deleteLeadParticipantAction(id)
    if (res.success) setParticipants((p) => p.filter((x) => x.id !== id))
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
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} icon={<UserPlus className="h-3.5 w-3.5" />}>
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
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 text-2xs font-semibold text-surface-500">
                    {(p.prenom?.[0] || '') + (p.nom?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      {[p.civilite, p.prenom, p.nom].filter(Boolean).join(' ')}
                      {p.poste && <span className="text-surface-400 font-normal"> · {p.poste}</span>}
                    </div>
                    <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
                      {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                      {p.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telephone}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(p.id)} className="text-surface-300 hover:text-danger-600 transition-colors shrink-0" title="Retirer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            !showForm && <p className="text-xs text-surface-400">Aucun participant saisi. Ces personnes deviendront apprenants à la signature de la convention.</p>
          )}

          {showForm && (
            <form onSubmit={handleAdd} className="space-y-2.5 rounded-xl bg-surface-50 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input name="prenom" placeholder="Prénom" />
                <Input name="nom" placeholder="Nom *" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input name="email" type="email" placeholder="Email" />
                <Input name="telephone" placeholder="Téléphone" />
              </div>
              <Input name="poste" placeholder="Poste / fonction" />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
                <Button type="submit" size="sm" isLoading={adding}>Ajouter</Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}
