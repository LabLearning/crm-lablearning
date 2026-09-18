'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, Search, Building2, User, Pencil, Trash2, Mail, Phone, MapPin, FolderPlus } from '@/components/ui/icons'
import { Button, Badge, Modal, useToast, RowMenu, PaginationBar } from '@/components/ui'
import { ClientForm } from './ClientForm'
import { deleteClientAction } from './actions'
import { CLIENT_TYPE_LABELS, FINANCEUR_LABELS } from '@/lib/types/crm'
import { formatDate, companyLabel } from '@/lib/utils'
import type { Client } from '@/lib/types/crm'

interface OrgUser { id: string; first_name: string | null; last_name: string | null; role?: string }

interface ClientsListProps {
  clients: Client[]
  users?: OrgUser[]
  franchises?: { id: string; nom: string }[]
  apporteurs?: { id: string; label: string }[]
  canAssign?: boolean
  total: number
  page: number
  perPage: number
  initialSearch: string
  initialType: string
}

export function ClientsList({ clients, users = [], franchises = [], apporteurs = [], canAssign = false, total, page, perPage, initialSearch, initialType }: ClientsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [search, setSearch] = useState(initialSearch)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const typeFilter = initialType
  const [createOpen, setCreateOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

  // Recherche et filtre côté serveur, pilotés par l'URL (?q=, ?type=)
  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    params.delete('page')
    router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`)
  }

  function handleSearch(value: string) {
    setSearch(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      updateParams((params) => {
        if (value.trim()) params.set('q', value.trim())
        else params.delete('q')
      })
    }, 350)
  }

  function handleTypeFilter(t: string) {
    updateParams((params) => {
      if (t === 'all') params.delete('type')
      else params.set('type', t)
    })
  }

  const filtered = clients

  function getDisplayName(c: Client): string {
    if (c.type === 'entreprise') return companyLabel(c) || 'Sans nom'
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
            {new Intl.NumberFormat('fr-FR').format(total)} client{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          {/* Le circuit standard : le dossier complet crée client + apprenants + session */}
          <Link href="/dashboard/dossiers/nouveau"
            className="btn-primary inline-flex items-center justify-center gap-1.5 !py-2 !px-4 text-sm min-h-10">
            <FolderPlus className="h-4 w-4" /> Nouveau dossier
          </Link>
          <Button variant="secondary" onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Client seul
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 sm:py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="h-10 sm:h-auto bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1 min-w-0"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['all', 'entreprise', 'particulier'].map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilter(t)}
              className={`min-h-10 sm:min-h-0 px-3.5 sm:px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
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

      {/* Liste mobile : une carte par client, ouverture au toucher, actions dans le menu */}
      <div className="card overflow-hidden md:hidden">
        <div className="divide-y divide-surface-100">
          {filtered.map((client) => (
            <div key={client.id} className="flex items-center gap-3 px-4 py-2.5">
              <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-3 flex-1 min-w-0 min-h-10">
                <div className={`p-2 rounded-lg shrink-0 ${client.type === 'entreprise' ? 'bg-brand-50' : 'bg-purple-50'}`}>
                  {client.type === 'entreprise' ? (
                    <Building2 className="h-4 w-4 text-brand-600" />
                  ) : (
                    <User className="h-4 w-4 text-purple-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-surface-900 truncate">{getDisplayName(client)}</div>
                  <div className="text-xs text-surface-500 flex items-center gap-x-2 flex-wrap">
                    {client.ville && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-surface-400" />{client.code_postal} {client.ville}</span>}
                    {client.financeur_type && <span className="text-warning-700">{FINANCEUR_LABELS[client.financeur_type]}</span>}
                    {!client.ville && !client.financeur_type && client.siret && <span className="font-mono text-surface-400">SIRET {client.siret}</span>}
                  </div>
                </div>
              </Link>
              <div className="shrink-0 -mr-2">
                <RowMenu triggerClassName="h-10 w-10 flex items-center justify-center" items={[
                  { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditClient(client) },
                  { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(client.id) },
                ]} />
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-surface-500">
            {search ? 'Aucun client trouvé pour cette recherche' : 'Aucun client. Créez votre premier client !'}
          </div>
        )}
        <PaginationBar total={total} page={page} perPage={perPage} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden hidden md:block">
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
        <PaginationBar total={total} page={page} perPage={perPage} />
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau client" size="lg">
        <ClientForm users={users} franchises={franchises} apporteurs={apporteurs} canAssign={canAssign} onSuccess={() => { setCreateOpen(false); toast('success', 'Client créé') }} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editClient} onClose={() => setEditClient(null)} title="Modifier le client" size="lg">
        {editClient && (
          <ClientForm client={editClient} users={users} franchises={franchises} apporteurs={apporteurs} canAssign={canAssign} onSuccess={() => { setEditClient(null); toast('success', 'Client mis à jour') }} onCancel={() => setEditClient(null)} />
        )}
      </Modal>
    </div>
  )
}
