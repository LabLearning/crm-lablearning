'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Pencil, Trash2, Mail, Phone, ChevronDown } from '@/components/ui/icons'
import { Modal, useToast, RowMenu } from '@/components/ui'
import { deleteApprenantAction } from '@/app/dashboard/apprenants/actions'
import { ApprenantForm } from '@/app/dashboard/apprenants/ApprenantForm'
import { Copiable, type FormatCopie } from '@/components/ui/CopyButton'
import { cn } from '@/lib/utils'

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
  // Fiche dépliée : l'état civil complet, champ par champ, à copier dans les formulaires OPCO
  const [ouvert, setOuvert] = useState<string | null>(null)

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
          {participants.map((p) => {
            const deplie = ouvert === p.id
            return (
              <div key={p.id} className="hover:bg-surface-50/60 transition-colors">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => setEditP(p)} aria-label={`Modifier ${p.prenom || ''} ${p.nom || ''}`.trim()}
                    className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-surface-600 shrink-0">
                    {(p.prenom?.[0] || '')}{(p.nom?.[0] || '')}
                  </button>
                  <div className="flex-1 min-w-0 py-1">
                    <button type="button" onClick={() => setEditP(p)} className="block max-w-full text-left text-sm font-medium text-surface-900 truncate hover:text-brand-600 transition-colors">
                      {p.prenom} {p.nom}
                      {p.poste && <span className="text-xs font-normal text-surface-400"> · {p.poste}</span>}
                    </button>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-surface-500">
                      {p.email && <span className="flex items-center gap-1 min-w-0"><Mail className="h-3 w-3 shrink-0" /><Copiable valeur={p.email} libelle="l’email" /></span>}
                      {p.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" /><Copiable valeur={p.telephone} format="telephone" libelle="le téléphone" /></span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => setOuvert(deplie ? null : p.id)} aria-expanded={deplie}
                    className="shrink-0 inline-flex items-center gap-1 min-h-10 px-2 rounded-lg text-xs font-medium text-surface-500 hover:text-brand-600 hover:bg-brand-50">
                    Détails <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', deplie && 'rotate-180')} />
                  </button>
                  <div className="shrink-0 -mr-2">
                    <RowMenu triggerClassName="h-10 w-10 flex items-center justify-center -my-2" items={[
                      { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditP(p) },
                      { label: 'Retirer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(p.id, `${p.prenom} ${p.nom}`) },
                    ]} />
                  </div>
                </div>
                {deplie && <FicheCopiable p={p} />}
              </div>
            )
          })}
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

/** État civil d'un participant, chaque champ avec son bouton de copie. */
function FicheCopiable({ p }: { p: Participant }) {
  const champs: { label: string; valeur: any; format?: FormatCopie; affichage?: string }[] = [
    { label: 'Nom', valeur: p.nom },
    { label: 'Prénom', valeur: p.prenom },
    { label: 'Civilité', valeur: p.civilite },
    { label: 'Date de naissance', valeur: p.date_naissance, format: 'date' },
    { label: 'Lieu de naissance', valeur: p.lieu_naissance },
    { label: 'N° sécurité sociale', valeur: p.numero_securite_sociale, format: 'chiffres' },
    { label: 'Email', valeur: p.email },
    { label: 'Téléphone', valeur: p.telephone, format: 'telephone' },
    { label: 'Adresse', valeur: p.adresse },
    { label: 'Code postal', valeur: p.code_postal },
    { label: 'Ville', valeur: p.ville },
    { label: 'Poste', valeur: p.poste },
    { label: 'Type de contrat', valeur: p.type_contrat },
  ]
  const remplis = champs.filter((c) => c.valeur !== null && c.valeur !== undefined && String(c.valeur).trim() !== '')
  return (
    <div className="px-4 pb-4 pl-[3.75rem]">
      {remplis.length === 0 ? (
        <div className="text-xs text-surface-400">Aucune information complémentaire. Complétez la fiche avec « Modifier ».</div>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-surface-50 p-3">
          {remplis.map((c) => (
            <div key={c.label} className="min-w-0">
              <dt className="text-2xs uppercase tracking-wider text-surface-400">{c.label}</dt>
              <dd className="text-sm text-surface-800">
                <Copiable valeur={c.valeur} format={c.format} libelle={c.label.toLowerCase()}>
                  {c.format === 'date' ? String(c.valeur).slice(0, 10).split('-').reverse().join('/') : String(c.valeur)}
                </Copiable>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
