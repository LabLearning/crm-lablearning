'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Pencil, Trash2, Mail, Phone, Save } from 'lucide-react'
import { Button, Modal, Input, useToast, RowMenu } from '@/components/ui'
import { createApprenantAction, updateApprenantAction, deleteApprenantAction } from '@/app/dashboard/apprenants/actions'

interface Participant {
  id: string
  prenom: string | null
  nom: string | null
  email: string | null
  telephone: string | null
  poste: string | null
}

function ParticipantForm({
  clientId, participant, onDone,
}: {
  clientId: string
  participant?: Participant
  onDone: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.set('client_id', clientId)
    const r = participant
      ? await updateApprenantAction(participant.id, fd)
      : await createApprenantAction(fd)
    if (r.success) { toast('success', participant ? 'Participant mis à jour' : 'Participant ajouté'); onDone() }
    else if (r.errors) setErrors(r.errors)
    else toast('error', r.error || 'Erreur')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input id="prenom" name="prenom" label="Prénom *" defaultValue={participant?.prenom || ''} error={errors.prenom?.[0]} />
        <Input id="nom" name="nom" label="Nom *" defaultValue={participant?.nom || ''} error={errors.nom?.[0]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="email" name="email" type="email" label="Email" defaultValue={participant?.email || ''} error={errors.email?.[0]} />
        <Input id="telephone" name="telephone" label="Téléphone" defaultValue={participant?.telephone || ''} />
      </div>
      <Input id="poste" name="poste" label="Poste" defaultValue={participant?.poste || ''} />
      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={loading} icon={<Save className="h-4 w-4" />}>
          {participant ? 'Mettre à jour' : 'Ajouter'}
        </Button>
      </div>
    </form>
  )
}

export function ClientParticipants({ clientId, participants }: { clientId: string; participants: Participant[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editP, setEditP] = useState<Participant | null>(null)

  async function handleDelete(id: string, nom: string) {
    if (!confirm(`Retirer ${nom} des participants de cette entreprise ?`)) return
    const r = await deleteApprenantAction(id)
    if (r.success) { toast('success', 'Participant retiré'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Employés / participants ({participants.length})
          </span>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {participants.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-surface-400">
          Aucun participant. Ajoutez les employés de l'entreprise pour les inscrire ensuite aux sessions.
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/60 transition-colors">
              <div className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-surface-600 shrink-0">
                {(p.prenom?.[0] || '')}{(p.nom?.[0] || '')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">
                  {p.prenom} {p.nom}
                  {p.poste && <span className="text-xs font-normal text-surface-400"> · {p.poste}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-surface-500">
                  {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                  {p.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telephone}</span>}
                </div>
              </div>
              <div className="shrink-0">
                <RowMenu items={[
                  { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditP(p) },
                  { label: 'Retirer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(p.id, `${p.prenom} ${p.nom}`) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un participant">
        <ClientParticipantFormWrapper clientId={clientId} onDone={() => { setAddOpen(false); router.refresh() }} />
      </Modal>
      <Modal isOpen={!!editP} onClose={() => setEditP(null)} title="Modifier le participant">
        {editP && <ClientParticipantFormWrapper clientId={clientId} participant={editP} onDone={() => { setEditP(null); router.refresh() }} />}
      </Modal>
    </div>
  )
}

function ClientParticipantFormWrapper(props: { clientId: string; participant?: Participant; onDone: () => void }) {
  return <ParticipantForm {...props} />
}
