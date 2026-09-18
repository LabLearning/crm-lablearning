'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Pencil, Trash2, Mail, Phone } from '@/components/ui/icons'
import { Modal, useToast, RowMenu } from '@/components/ui'
import { deleteApprenantAction } from '@/app/dashboard/apprenants/actions'
import { ApprenantForm } from '@/app/dashboard/apprenants/ApprenantForm'

interface Participant {
  id: string
  prenom: string | null
  nom: string | null
  email: string | null
  telephone: string | null
  poste: string | null
  [key: string]: any
}

export function ClientParticipants({ clientId, clientNom, participants }: { clientId: string; clientNom: string; participants: Participant[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editP, setEditP] = useState<Participant | null>(null)

  // Formulaire complet : l'entreprise est présélectionnée sur ce client
  const clientsForForm = [{ id: clientId, raison_sociale: clientNom }]

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
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 min-h-10 -my-3 px-2 -mr-2 rounded-lg text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 shrink-0">
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
              <button type="button" onClick={() => setEditP(p)}
                className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-surface-600 shrink-0">
                {(p.prenom?.[0] || '')}{(p.nom?.[0] || '')}
              </button>
              <button type="button" onClick={() => setEditP(p)} className="flex-1 min-w-0 text-left min-h-10 py-1">
                <div className="text-sm font-medium text-surface-900 truncate hover:text-brand-600 transition-colors">
                  {p.prenom} {p.nom}
                  {p.poste && <span className="text-xs font-normal text-surface-400"> · {p.poste}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-surface-500">
                  {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                  {p.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telephone}</span>}
                </div>
              </button>
              <div className="shrink-0 -mr-2">
                <RowMenu triggerClassName="h-10 w-10 flex items-center justify-center -my-2" items={[
                  { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditP(p) },
                  { label: 'Retirer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(p.id, `${p.prenom} ${p.nom}`) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un participant" size="lg">
        <ApprenantForm clients={clientsForForm} defaultClientId={clientId} onDone={() => { setAddOpen(false); router.refresh() }} />
      </Modal>
      <Modal isOpen={!!editP} onClose={() => setEditP(null)} title="Modifier le participant" size="lg">
        {editP && <ApprenantForm apprenant={editP as any} clients={clientsForForm} defaultClientId={clientId} onDone={() => { setEditP(null); router.refresh() }} />}
      </Modal>
    </div>
  )
}
