'use client'

import { useState, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, Save,
  UserCheck, Building2, Mail, Phone, Accessibility,
  GraduationCap, Calendar, AlertTriangle, ClipboardPaste,
} from 'lucide-react'
import { Button, Badge, Input, Select, Modal, Avatar, useToast, RowMenu, PaginationBar } from '@/components/ui'
import {
  createApprenantAction, updateApprenantAction,
  deleteApprenantAction, inscrireApprenantAction, bulkCreateApprenantsAction,
} from './actions'
import { ImportParticipantsModal } from '@/components/participants/ImportParticipantsModal'
import { ApprenantForm } from './ApprenantForm'
import { formatDate } from '@/lib/utils'
import type { Apprenant, Session, Inscription } from '@/lib/types/formation'
import type { Client } from '@/lib/types/crm'
import { INSCRIPTION_STATUS_LABELS, INSCRIPTION_STATUS_COLORS } from '@/lib/types/formation'

interface ApprenantsListProps {
  apprenants: Apprenant[]
  clients: Pick<Client, 'id' | 'raison_sociale'>[]
  sessions: Pick<Session, 'id' | 'reference' | 'date_debut' | 'date_fin' | 'formation'>[]
  inscriptions: Inscription[]
  total: number
  page: number
  perPage: number
  initialSearch: string
}

export function ApprenantsList({ apprenants, clients, sessions, inscriptions, total, page, perPage, initialSearch }: ApprenantsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editApprenant, setEditApprenant] = useState<Apprenant | null>(null)
  const [inscrireApprenant, setInscrireApprenant] = useState<Apprenant | null>(null)
  const [parcourApprenant, setParcourApprenant] = useState<Apprenant | null>(null)

  // Recherche côté serveur (URL ?q=), débouncée
  function handleSearch(value: string) {
    setSearch(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) params.set('q', value.trim())
      else params.delete('q')
      params.delete('page')
      router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`)
    }, 350)
  }

  const filtered = apprenants

  function getInscriptions(apprenantId: string) {
    return inscriptions.filter((i) => i.apprenant_id === apprenantId)
  }

  async function handleImport(rows: any[]) {
    const result = await bulkCreateApprenantsAction(rows)
    if (result.success) {
      const count = (result.data as any[])?.length || 0
      toast('success', `${count} apprenant${count > 1 ? 's' : ''} importé${count > 1 ? 's' : ''}`)
      router.refresh()
      return { success: true }
    }
    return { success: false, error: result.error || 'Erreur' }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet apprenant ?')) return
    const result = await deleteApprenantAction(id)
    if (result.success) toast('success', 'Apprenant supprimé')
    else toast('error', result.error || 'Erreur')
  }

  async function handleInscrire(apprenantId: string, sessionId: string) {
    const result = await inscrireApprenantAction(apprenantId, sessionId)
    if (result.success) { toast('success', 'Inscription enregistrée'); setInscrireApprenant(null) }
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Apprenants</h1>
          <p className="text-surface-500 mt-1 text-sm">{new Intl.NumberFormat('fr-FR').format(total)} apprenant{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)} icon={<ClipboardPaste className="h-4 w-4" />}>Importer depuis un texte</Button>
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouvel apprenant</Button>
        </div>
      </div>

      <ImportParticipantsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        existing={apprenants}
        onConfirm={handleImport}
        title="Importer des apprenants depuis un texte"
      />

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none flex-1" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Apprenant</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Entreprise</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Formations</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Statut</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((a) => {
                const appInscriptions = getInscriptions(a.id)
                return (
                  <tr key={a.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={a.prenom} lastName={a.nom} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-surface-900 flex items-center gap-1.5">
                            {a.civilite} {a.prenom} {a.nom}
                            {a.situation_handicap && (
                              <Accessibility className="h-3.5 w-3.5 text-brand-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-surface-500">
                            {a.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" />{a.email}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 hidden md:table-cell">
                      {a.entreprise || a.client?.raison_sociale ? (
                        <div className="flex items-center gap-1 text-sm text-surface-600">
                          <Building2 className="h-3.5 w-3.5 text-surface-400" />
                          {a.entreprise || a.client?.raison_sociale}
                        </div>
                      ) : <span className="text-sm text-surface-400">—</span>}
                    </td>
                    <td className="px-6 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-surface-600">
                        {appInscriptions.length} formation{appInscriptions.length > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 hidden lg:table-cell">
                      {appInscriptions.length > 0 ? (
                        <div className="flex gap-1">
                          {appInscriptions.slice(0, 2).map((ins) => (
                            <Badge key={ins.id} variant={INSCRIPTION_STATUS_COLORS[ins.status]}>
                              {INSCRIPTION_STATUS_LABELS[ins.status]}
                            </Badge>
                          ))}
                          {appInscriptions.length > 2 && (
                            <Badge variant="default">+{appInscriptions.length - 2}</Badge>
                          )}
                        </div>
                      ) : <span className="text-sm text-surface-400">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-block">
                        <RowMenu
                          width={208}
                          items={[
                            { label: 'Voir le parcours', icon: <GraduationCap className="h-4 w-4 text-surface-400" />, onClick: () => setParcourApprenant(a) },
                            { label: 'Inscrire à une session', icon: <Calendar className="h-4 w-4 text-brand-600" />, onClick: () => setInscrireApprenant(a) },
                            { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditApprenant(a) },
                            { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(a.id), danger: true },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-surface-500">
            {search ? 'Aucun apprenant trouvé' : 'Aucun apprenant enregistré'}
          </div>
        )}
        <PaginationBar total={total} page={page} perPage={perPage} />
      </div>

      {/* Create / Edit */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvel apprenant" size="lg">
        <ApprenantForm clients={clients} onDone={() => setCreateOpen(false)} />
      </Modal>
      <Modal isOpen={!!editApprenant} onClose={() => setEditApprenant(null)} title="Modifier l'apprenant" size="lg">
        {editApprenant && <ApprenantForm apprenant={editApprenant} clients={clients} onDone={() => setEditApprenant(null)} />}
      </Modal>

      {/* Inscription modal */}
      <Modal isOpen={!!inscrireApprenant} onClose={() => setInscrireApprenant(null)} title="Inscrire à une session">
        {inscrireApprenant && (
          <div className="space-y-3">
            <p className="text-sm text-surface-600">
              Inscrire <strong>{inscrireApprenant.prenom} {inscrireApprenant.nom}</strong> à une session :
            </p>
            {sessions.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleInscrire(inscrireApprenant.id, s.id)}
                    className="flex items-center justify-between w-full p-3 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-medium text-surface-800">
                        {s.formation?.intitule || s.reference || 'Session'}
                      </div>
                      <div className="text-xs text-surface-500">
                        {s.reference} · {formatDate(s.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(s.date_fin, { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-brand-500" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400 text-center py-4">Aucune session disponible</p>
            )}
          </div>
        )}
      </Modal>

      {/* Parcours modal */}
      <Modal isOpen={!!parcourApprenant} onClose={() => setParcourApprenant(null)} title={parcourApprenant ? `Parcours de ${parcourApprenant.prenom} ${parcourApprenant.nom}` : ''} size="lg">
        {parcourApprenant && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Handicap info */}
            {parcourApprenant.situation_handicap && (
              <div className="p-3 rounded-xl bg-brand-50 border border-brand-200">
                <div className="flex items-center gap-2 text-sm font-medium text-brand-700 mb-1">
                  <Accessibility className="h-4 w-4" /> Situation de handicap
                </div>
                {parcourApprenant.type_handicap && (
                  <div className="text-xs text-brand-600">Type : {parcourApprenant.type_handicap}</div>
                )}
                {parcourApprenant.besoins_adaptation && (
                  <div className="text-xs text-brand-600 mt-1">Adaptations : {parcourApprenant.besoins_adaptation}</div>
                )}
              </div>
            )}

            {/* Inscriptions list */}
            {getInscriptions(parcourApprenant.id).length > 0 ? (
              <div className="space-y-2">
                {getInscriptions(parcourApprenant.id).map((ins) => (
                  <div key={ins.id} className="p-3 rounded-xl bg-surface-50 border border-surface-200/60">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-surface-800">
                        {ins.session?.reference || 'Session'}
                      </div>
                      <Badge variant={INSCRIPTION_STATUS_COLORS[ins.status]}>
                        {INSCRIPTION_STATUS_LABELS[ins.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-surface-500">
                      Inscrit le {formatDate(ins.date_inscription, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {ins.taux_assiduite > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-2xs text-surface-500 mb-0.5">
                          <span>Assiduité</span>
                          <span>{ins.taux_assiduite}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-200">
                          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${ins.taux_assiduite}%` }} />
                        </div>
                      </div>
                    )}
                    {(ins.note_evaluation_entree || ins.note_evaluation_sortie) && (
                      <div className="flex gap-4 mt-2 text-xs">
                        {ins.note_evaluation_entree !== null && (
                          <span className="text-surface-500">Entrée : <strong className="text-surface-700">{ins.note_evaluation_entree}/20</strong></span>
                        )}
                        {ins.note_evaluation_sortie !== null && (
                          <span className="text-surface-500">Sortie : <strong className="text-surface-700">{ins.note_evaluation_sortie}/20</strong></span>
                        )}
                        {ins.progression !== null && (
                          <span className="text-success-600 font-medium">+{ins.progression}%</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-surface-400">
                Aucune formation suivie pour le moment
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
