'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Building2, User, Pencil, Trash2, Mail, Phone, MapPin } from 'lucide-react'
import { Button, Badge, Modal, useToast, RowMenu } from '@/components/ui'
import { ClientForm } from './ClientForm'
import { deleteClientAction } from './actions'
import { CLIENT_TYPE_LABELS, FINANCEUR_LABELS } from '@/lib/types/crm'
import { formatDate } from '@/lib/utils'
import type { Client } from '@/lib/types/crm'

interface OrgUser { id: string; first_name: string | null; last_name: string | null; role?: string }

interface ClientsListProps {
  clients: Client[]
  users?: OrgUser[]
  canAssign?: boolean
}

export function ClientsList({ clients, users = [], canAssign = false }: ClientsListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        (c.raison_sociale || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.nom || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.prenom || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || c.type === typeFilter
      return matchSearch && matchType
    })
  }, [clients, search, typeFilter])

  function getDisplayName(c: Client): string {
    if (c.type === 'entreprise') return c.raison_sociale || 'Sans nom'
    return `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Sans nom'
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce client ?')) return
    const result = await deleteClientAction(id)
    if (result.success) toast('success', 'Client supprimé')
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Clients</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
          Nouveau client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'entreprise', 'particulier'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-surface-900 text-white shadow-xs'
                  : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'
              }`}
            >
              {t === 'all' ? 'Tous' : CLIENT_TYPE_LABELS[t as 'entreprise' | 'particulier']}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Client</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Type</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Contact</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Localisation</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden xl:table-cell">Financeur</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  className="hover:bg-surface-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${client.type === 'entreprise' ? 'bg-brand-50' : 'bg-purple-50'}`}>
                        {client.type === 'entreprise' ? (
                          <Building2 className="h-4 w-4 text-brand-600" />
                        ) : (
                          <User className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">
                          {getDisplayName(client)}
                        </div>
                        {client.siret && (
                          <div className="text-xs text-surface-400 font-mono">SIRET {client.siret}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 hidden md:table-cell">
                    <Badge variant={client.type === 'entreprise' ? 'info' : 'default'}>
                      {CLIENT_TYPE_LABELS[client.type]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell">
                    <div className="space-y-0.5">
                      {client.email && (
                        <div className="flex items-center gap-1 text-xs text-surface-600">
                          <Mail className="h-3 w-3 text-surface-400" /> {client.email}
                        </div>
                      )}
                      {client.telephone && (
                        <div className="flex items-center gap-1 text-xs text-surface-600">
                          <Phone className="h-3 w-3 text-surface-400" /> {client.telephone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell">
                    {client.ville ? (
                      <div className="flex items-center gap-1 text-sm text-surface-600">
                        <MapPin className="h-3.5 w-3.5 text-surface-400" />
                        {client.code_postal} {client.ville}
                      </div>
                    ) : (
                      <span className="text-sm text-surface-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 hidden xl:table-cell">
                    {client.financeur_type ? (
                      <Badge variant="warning">{FINANCEUR_LABELS[client.financeur_type]}</Badge>
                    ) : (
                      <span className="text-sm text-surface-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-block">
                      <RowMenu items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditClient(client) },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(client.id) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-surface-500">
            {search ? 'Aucun client trouvé pour cette recherche' : 'Aucun client. Créez votre premier client !'}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau client" size="lg">
        <ClientForm users={users} canAssign={canAssign} onSuccess={() => { setCreateOpen(false); toast('success', 'Client créé') }} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editClient} onClose={() => setEditClient(null)} title="Modifier le client" size="lg">
        {editClient && (
          <ClientForm client={editClient} users={users} canAssign={canAssign} onSuccess={() => { setEditClient(null); toast('success', 'Client mis à jour') }} onCancel={() => setEditClient(null)} />
        )}
      </Modal>
    </div>
  )
}
