'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Pencil, Trash2,
  Mail, Phone, Building2, Star, PenTool, GraduationCap, Save,
} from 'lucide-react'
import { Button, Badge, Input, Select, Modal, Avatar, useToast, RowMenu } from '@/components/ui'
import { createContactAction, updateContactAction, deleteContactAction } from './actions'
import type { Contact, Client } from '@/lib/types/crm'

interface ContactsListProps {
  contacts: Contact[]
  clients: Pick<Client, 'id' | 'raison_sociale' | 'type'>[]
}

export function ContactsList({ contacts, clients }: ContactsListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)

  const clientOptions = [
    { value: '', label: 'Aucun client' },
    ...clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id })),
  ]

  const filtered = useMemo(() => {
    if (!search) return contacts
    const s = search.toLowerCase()
    return contacts.filter(
      (c) =>
        c.prenom.toLowerCase().includes(s) ||
        c.nom.toLowerCase().includes(s) ||
        (c.email || '').toLowerCase().includes(s) ||
        (c.poste || '').toLowerCase().includes(s)
    )
  }, [contacts, search])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce contact ?')) return
    const result = await deleteContactAction(id)
    if (result.success) toast('success', 'Contact supprimé')
    else toast('error', result.error || 'Erreur')
  }

  function ContactForm({ contact, onDone }: { contact?: Contact; onDone: () => void }) {
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string[]>>({})

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      setIsLoading(true)
      setErrors({})
      const fd = new FormData(e.currentTarget)
      const result = contact ? await updateContactAction(contact.id, fd) : await createContactAction(fd)
      if (result.success) {
        toast('success', contact ? 'Contact mis à jour' : 'Contact créé')
        onDone()
      } else if (result.errors) setErrors(result.errors)
      else toast('error', result.error || 'Erreur')
      setIsLoading(false)
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select id="client_id" name="client_id" label="Client rattaché" options={clientOptions} defaultValue={contact?.client_id || ''} />
        <div className="grid grid-cols-3 gap-3">
          <Select id="civilite" name="civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} defaultValue={contact?.civilite || ''} />
          <Input id="prenom" name="prenom" label="Prénom *" defaultValue={contact?.prenom || ''} error={errors.prenom?.[0]} />
          <Input id="nom" name="nom" label="Nom *" defaultValue={contact?.nom || ''} error={errors.nom?.[0]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="email" name="email" type="email" label="Email" defaultValue={contact?.email || ''} error={errors.email?.[0]} />
          <Input id="telephone" name="telephone" label="Téléphone" defaultValue={contact?.telephone || ''} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="mobile" name="mobile" label="Mobile" defaultValue={contact?.mobile || ''} />
          <Input id="poste" name="poste" label="Poste / Fonction" defaultValue={contact?.poste || ''} />
        </div>
        <Input id="service" name="service" label="Service / Département" defaultValue={contact?.service || ''} />

        <div className="rounded-xl border border-surface-200 p-3 bg-surface-50/40">
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.07z"/></svg>
            <span className="text-sm font-medium text-surface-800">WhatsApp</span>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Input id="whatsapp" name="whatsapp" label="Numéro WhatsApp" placeholder="06 12 34 56 78" defaultValue={(contact as any)?.whatsapp || ''} />
            <label className="flex items-center gap-2 text-sm text-surface-700 pb-2.5 cursor-pointer">
              <input type="checkbox" name="whatsapp_opt_in" value="true" defaultChecked={(contact as any)?.whatsapp_opt_in || false}
                className="h-4 w-4 rounded border-surface-300 text-emerald-600 focus:ring-emerald-500" />
              Accepte les rappels par WhatsApp
            </label>
          </div>
          <p className="text-[11px] text-surface-400 mt-1.5">Consentement requis (RGPD + Meta).</p>
        </div>

        <div className="flex flex-wrap gap-4 py-2">
          {[
            { name: 'est_principal', label: 'Contact principal', checked: contact?.est_principal },
            { name: 'est_signataire', label: 'Signataire', checked: contact?.est_signataire },
            { name: 'est_referent_formation', label: 'Référent formation', checked: contact?.est_referent_formation },
          ].map((cb) => (
            <label key={cb.name} className="flex items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" name={cb.name} value="true" defaultChecked={cb.checked} className="rounded border-surface-300" />
              {cb.label}
            </label>
          ))}
        </div>

        <textarea id="notes" name="notes" rows={2} className="input-base resize-none" placeholder="Notes..." defaultValue={contact?.notes || ''} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
          <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
            {contact ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Contacts</h1>
          <p className="text-surface-500 mt-1 text-sm">{contacts.length} contact{contacts.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau contact</Button>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Client</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Poste</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Rôles</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((contact) => (
                <tr key={contact.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={contact.prenom} lastName={contact.nom} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-surface-900">
                          {contact.civilite} {contact.prenom} {contact.nom}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-surface-500">
                          {contact.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {contact.email}</span>}
                          {contact.telephone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {contact.telephone}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 hidden md:table-cell">
                    {contact.client ? (
                      <div className="flex items-center gap-1 text-sm text-surface-600">
                        <Building2 className="h-3.5 w-3.5 text-surface-400" />
                        {contact.client.raison_sociale || '—'}
                      </div>
                    ) : <span className="text-sm text-surface-400">—</span>}
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell text-sm text-surface-600">{contact.poste || '—'}</td>
                  <td className="px-6 py-3.5 hidden lg:table-cell">
                    <div className="flex gap-1">
                      {contact.est_principal && <Badge variant="info"><Star className="h-3 w-3 mr-0.5" />Principal</Badge>}
                      {contact.est_signataire && <Badge variant="warning"><PenTool className="h-3 w-3 mr-0.5" />Signataire</Badge>}
                      {contact.est_referent_formation && <Badge variant="success"><GraduationCap className="h-3 w-3 mr-0.5" />Réf. formation</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="inline-block">
                      <RowMenu items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditContact(contact) },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(contact.id), danger: true },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-sm text-surface-500">Aucun contact trouvé</div>}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau contact" size="lg">
        <ContactForm onDone={() => setCreateOpen(false)} />
      </Modal>

      <Modal isOpen={!!editContact} onClose={() => setEditContact(null)} title="Modifier le contact" size="lg">
        {editContact && <ContactForm contact={editContact} onDone={() => setEditContact(null)} />}
      </Modal>
    </div>
  )
}
