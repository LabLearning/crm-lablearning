'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, User, Mail, Phone, Pencil, Trash2, Save } from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import { createContactAction, updateContactAction, deleteContactAction } from '@/app/dashboard/contacts/actions'

interface Contact {
  id: string
  civilite: string | null
  prenom: string | null
  nom: string
  email: string | null
  telephone: string | null
  mobile: string | null
  poste: string | null
  service: string | null
  est_principal: boolean
  est_signataire: boolean
  est_referent_formation: boolean
}

const civiliteOptions = [{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]

export function ClientContacts({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)

  function openNew() { setEditing(null); setOpen(true) }
  function openEdit(c: Contact) { setEditing(c); setOpen(true) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('client_id', clientId)
    // Les cases décochées n'apparaissent pas dans le FormData : on force la valeur
    for (const k of ['est_principal', 'est_signataire', 'est_referent_formation']) {
      fd.set(k, fd.get(k) === 'on' ? 'true' : 'false')
    }
    const r = editing ? await updateContactAction(editing.id, fd) : await createContactAction(fd)
    setSaving(false)
    if (r.success) {
      toast('success', editing ? 'Contact mis à jour' : 'Contact ajouté')
      setOpen(false); setEditing(null)
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  async function handleDelete(c: Contact) {
    if (!confirm(`Supprimer le contact « ${[c.prenom, c.nom].filter(Boolean).join(' ')} » ?`)) return
    const r = await deleteContactAction(c.id)
    if (r.success) { toast('success', 'Contact supprimé'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Contacts ({contacts.length})</span>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
          <UserPlus className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-400">Aucun contact rattaché</div>
      ) : (
        <div className="divide-y divide-surface-100">
          {contacts.map((ct) => (
            <div key={ct.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/60 transition-colors">
              <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-surface-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">
                  {[ct.civilite, ct.prenom, ct.nom].filter(Boolean).join(' ')}
                  {ct.est_principal && <Badge variant="info" className="ml-2">Principal</Badge>}
                  {ct.est_signataire && <Badge variant="default" className="ml-1">Signataire</Badge>}
                </div>
                <div className="text-xs text-surface-500 flex items-center gap-3 flex-wrap">
                  {ct.poste && <span>{ct.poste}</span>}
                  {ct.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{ct.email}</span>}
                  {(ct.telephone || ct.mobile) && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{ct.telephone || ct.mobile}</span>}
                </div>
              </div>
              <div className="shrink-0">
                <RowMenu items={[
                  { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => openEdit(ct) },
                  { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(ct) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Modifier le contact' : 'Nouveau contact'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Select id="civilite" name="civilite" label="Civilité" options={civiliteOptions} defaultValue={editing?.civilite || ''} />
            <Input id="prenom" name="prenom" label="Prénom" defaultValue={editing?.prenom || ''} />
            <Input id="nom" name="nom" label="Nom *" defaultValue={editing?.nom || ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="email" name="email" type="email" label="Email" defaultValue={editing?.email || ''} />
            <Input id="poste" name="poste" label="Poste" defaultValue={editing?.poste || ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="telephone" name="telephone" label="Téléphone" defaultValue={editing?.telephone || ''} />
            <Input id="mobile" name="mobile" label="Mobile" defaultValue={editing?.mobile || ''} />
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
              <input type="checkbox" name="est_principal" defaultChecked={editing?.est_principal} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
              Contact principal
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
              <input type="checkbox" name="est_signataire" defaultChecked={editing?.est_signataire} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
              Signataire
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
              <input type="checkbox" name="est_referent_formation" defaultChecked={editing?.est_referent_formation} className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
              Référent formation
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEditing(null) }}>Annuler</Button>
            <Button type="submit" isLoading={saving} icon={<Save className="h-4 w-4" />}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
