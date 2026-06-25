'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Trash2, PenTool, FileText,
  FolderOpen, Download, Eye, Send,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import { createDocumentAction, requestSignatureAction, deleteDocumentAction } from './actions'
import { DOCUMENT_TYPE_LABELS, SIGNATURE_STATUS_LABELS, SIGNATURE_STATUS_COLORS } from '@/lib/types/document'
import { formatDate } from '@/lib/utils'
import type { Document as DocType, DocumentType } from '@/lib/types/document'

interface DocumentsListProps {
  documents: DocType[]
}

const typeOptions = Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function DocumentsList({ documents }: DocumentsListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [signatureDoc, setSignatureDoc] = useState<DocType | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || d.type === typeFilter
      return matchSearch && matchType
    })
  }, [documents, search, typeFilter])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true)
    const result = await createDocumentAction(new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Document créé'); setCreateOpen(false) }
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleRequestSignature(docId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = await requestSignatureAction(docId, new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Demande de signature envoyée'); setSignatureDoc(null) }
    else toast('error', result.error || 'Erreur')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce document ?')) return
    const result = await deleteDocumentAction(id)
    if (result.success) toast('success', 'Document supprimé')
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Documents</h1>
          <p className="text-surface-500 mt-1 text-sm">{documents.length} document{documents.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau document</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 flex-1 max-w-md">
          <Search className="h-4 w-4 text-surface-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1" />
        </div>
        <Select
          options={[{ value: 'all', label: 'Tous les types' }, ...typeOptions]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Document</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Signatures</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Date</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((doc) => {
                const sigPending = (doc.signatures || []).filter((s) => s.status === 'en_attente').length
                const sigTotal = (doc.signatures || []).length
                const sigSigned = (doc.signatures || []).filter((s) => s.status === 'signe').length
                return (
                  <tr key={doc.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-100"><FileText className="h-4 w-4 text-surface-500" /></div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-surface-900 truncate">{doc.nom}</div>
                          {doc.description && <div className="text-xs text-surface-500 truncate">{doc.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5"><Badge variant="default">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge></td>
                    <td className="px-6 py-3.5 hidden md:table-cell">
                      {sigTotal > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-surface-600">{sigSigned}/{sigTotal}</span>
                          {sigPending > 0 && <Badge variant="warning">{sigPending} en attente</Badge>}
                          {sigPending === 0 && sigTotal > 0 && <Badge variant="success">Complet</Badge>}
                        </div>
                      ) : doc.requires_signature ? (
                        <span className="text-xs text-surface-400">Non demandée</span>
                      ) : <span className="text-xs text-surface-400">—</span>}
                    </td>
                    <td className="px-6 py-3.5 hidden lg:table-cell text-sm text-surface-500">
                      {formatDate(doc.created_at, { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-block">
                        <RowMenu
                          width={208}
                          items={[
                            { label: 'Demander une signature', icon: <PenTool className="h-4 w-4 text-brand-600" />, onClick: () => setSignatureDoc(doc), hidden: !doc.requires_signature },
                            { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(doc.id), danger: true },
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
            <FolderOpen className="h-6 w-6 text-surface-400" />
            Aucun document
          </div>
        )}
      </div>

      {/* Create */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau document">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input name="nom" label="Nom du document *" placeholder="Convention — Client X" />
          <Select name="type" label="Type" options={typeOptions} defaultValue="autre" />
          <textarea name="description" rows={2} className="input-base resize-none" placeholder="Description..." />
          <label className="flex items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" name="requires_signature" value="true" className="rounded border-surface-300" />
            Nécessite une signature
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* Request Signature */}
      <Modal isOpen={!!signatureDoc} onClose={() => setSignatureDoc(null)} title="Demander une signature">
        {signatureDoc && (
          <form onSubmit={(e) => handleRequestSignature(signatureDoc.id, e)} className="space-y-4">
            <p className="text-sm text-surface-600">Document : <strong>{signatureDoc.nom}</strong></p>
            <Input name="signataire_nom" label="Nom du signataire *" />
            <Input name="signataire_email" type="email" label="Email du signataire *" />
            <Select name="signataire_role" label="Rôle" options={[
              { value: 'client', label: 'Client' }, { value: 'apprenant', label: 'Apprenant' },
              { value: 'formateur', label: 'Formateur' }, { value: 'of', label: 'Organisme de formation' },
            ]} defaultValue="client" />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setSignatureDoc(null)}>Annuler</Button>
              <Button type="submit" icon={<Send className="h-4 w-4" />}>Envoyer</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
