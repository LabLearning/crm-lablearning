'use client'

import { useState, useMemo, useRef } from 'react'
import {
  Plus, Search, Trash2, PenTool, FileText,
  FolderOpen, Send, Upload, Loader2, Paperclip, Mail,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import { createDocumentAction, requestSignatureAction, deleteDocumentAction, sendDocumentByEmailAction } from './actions'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/document'
import { formatDate } from '@/lib/utils'
import type { Document as DocType } from '@/lib/types/document'

interface Recipient { id: string; prenom: string; nom: string; email: string | null; client?: { raison_sociale: string | null } | null }

interface DocumentsListProps {
  documents: DocType[]
  formateurs: Recipient[]
  apprenants: Recipient[]
  contacts: Recipient[]
}

const typeOptions = Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function DocumentsList({ documents, formateurs, apprenants, contacts }: DocumentsListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [signatureDoc, setSignatureDoc] = useState<DocType | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Upload à la création
  const [uploaded, setUploaded] = useState<{ storage_path: string; file_name: string; file_size: number; mime_type: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Envoi par email
  const [sendDoc, setSendDoc] = useState<DocType | null>(null)
  const [sending, setSending] = useState(false)
  const [recipType, setRecipType] = useState<'formateur' | 'apprenant' | 'contact' | 'libre'>('formateur')
  const [recipEmail, setRecipEmail] = useState('')
  const [recipName, setRecipName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || d.type === typeFilter
      return matchSearch && matchType
    })
  }, [documents, search, typeFilter])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (res.ok) { setUploaded(json); toast('success', 'Fichier importé') }
    else toast('error', json.error || 'Échec de l\'import')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function resetCreate() {
    setCreateOpen(false)
    setUploaded(null)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true)
    const fd = new FormData(e.currentTarget)
    if (uploaded) {
      fd.set('storage_path', uploaded.storage_path)
      fd.set('file_name', uploaded.file_name)
      fd.set('file_size', String(uploaded.file_size))
      fd.set('mime_type', uploaded.mime_type)
    }
    const result = await createDocumentAction(fd)
    if (result.success) { toast('success', 'Document créé'); resetCreate() }
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

  function openSend(doc: DocType) {
    setSendDoc(doc)
    setRecipType('formateur')
    setRecipEmail('')
    setRecipName('')
    setSubject(doc.nom)
    setMessage('')
  }

  function pickRecipient(id: string, list: Recipient[]) {
    const r = list.find((x) => x.id === id)
    if (r) {
      setRecipEmail(r.email || '')
      setRecipName(`${r.prenom || ''} ${r.nom || ''}`.trim())
    } else {
      setRecipEmail('')
      setRecipName('')
    }
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sendDoc) return
    if (!recipEmail) { toast('error', 'Choisissez un destinataire'); return }
    setSending(true)
    const fd = new FormData()
    fd.set('recipient_email', recipEmail)
    fd.set('recipient_name', recipName)
    fd.set('recipient_type', recipType)
    fd.set('subject', subject)
    fd.set('message', message)
    const result = await sendDocumentByEmailAction(sendDoc.id, fd)
    if (result.success) { toast('success', `Document envoyé à ${recipEmail}`); setSendDoc(null) }
    else toast('error', result.error || 'Erreur')
    setSending(false)
  }

  const currentList = recipType === 'formateur' ? formateurs : recipType === 'apprenant' ? apprenants : contacts

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
          <Search className="h-4 w-4 text-surface-400 shrink-0" />
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
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Fichier</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Date</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-surface-100 shrink-0"><FileText className="h-4 w-4 text-surface-500" /></div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">{doc.nom}</div>
                        {doc.description && <div className="text-xs text-surface-500 truncate">{doc.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5"><Badge variant="default">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge></td>
                  <td className="px-6 py-3.5 hidden md:table-cell">
                    {doc.storage_path ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-surface-600">
                        <Paperclip className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{doc.file_name}</span>
                        {doc.file_size ? <span className="text-surface-400">· {fmtSize(doc.file_size)}</span> : null}
                      </span>
                    ) : <span className="text-xs text-surface-400">Aucun fichier</span>}
                  </td>
                  <td className="px-6 py-3.5 hidden lg:table-cell text-sm text-surface-500">
                    {formatDate(doc.created_at, { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="inline-block">
                      <RowMenu
                        width={220}
                        items={[
                          { label: 'Envoyer par email', icon: <Mail className="h-4 w-4 text-brand-600" />, onClick: () => openSend(doc), hidden: !doc.storage_path },
                          { label: 'Demander une signature', icon: <PenTool className="h-4 w-4 text-brand-600" />, onClick: () => setSignatureDoc(doc), hidden: !doc.requires_signature },
                          { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(doc.id), danger: true },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-surface-500">
            <FolderOpen className="h-6 w-6 text-surface-400 mx-auto mb-2" />
            Aucun document
          </div>
        )}
      </div>

      {/* Create */}
      <Modal isOpen={createOpen} onClose={resetCreate} title="Nouveau document">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input name="nom" label="Nom du document *" placeholder="Process formateur — accueil" />
          <Select name="type" label="Type" options={typeOptions} defaultValue="autre" />
          <textarea name="description" rows={2} className="input-base resize-none" placeholder="Description..." />

          {/* Upload fichier */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Fichier</label>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/png,image/jpeg,image/webp" />
            {uploaded ? (
              <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
                <Paperclip className="h-4 w-4 text-brand-500 shrink-0" />
                <span className="text-sm text-surface-700 truncate flex-1">{uploaded.file_name}</span>
                <span className="text-xs text-surface-400">{fmtSize(uploaded.file_size)}</span>
                <button type="button" onClick={() => setUploaded(null)} className="text-xs text-surface-400 hover:text-danger-600">Retirer</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 w-full rounded-xl border border-dashed border-surface-300 px-3 py-2.5 text-sm text-surface-500 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-60">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Import en cours...' : 'Importer un fichier (PDF, Word, Excel, image — 20 Mo max)'}
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" name="requires_signature" value="true" className="rounded border-surface-300" />
            Nécessite une signature
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={resetCreate}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} disabled={uploading}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* Envoyer par email */}
      <Modal isOpen={!!sendDoc} onClose={() => setSendDoc(null)} title="Envoyer le document par email">
        {sendDoc && (
          <form onSubmit={handleSend} className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-surface-50 border border-surface-200/60 px-3 py-2.5">
              <Paperclip className="h-4 w-4 text-brand-500 shrink-0" />
              <span className="text-sm text-surface-700 truncate">{sendDoc.file_name || sendDoc.nom}</span>
              <span className="text-2xs text-surface-400 ml-auto">joint en pièce jointe</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Type de destinataire"
                options={[
                  { value: 'formateur', label: 'Formateur' },
                  { value: 'apprenant', label: 'Apprenant' },
                  { value: 'contact', label: 'Client / contact' },
                  { value: 'libre', label: 'Email libre' },
                ]}
                value={recipType}
                onChange={(e) => { setRecipType(e.target.value as any); setRecipEmail(''); setRecipName('') }}
              />
              {recipType !== 'libre' ? (
                <Select
                  label="Destinataire"
                  options={[
                    { value: '', label: `— Choisir —` },
                    ...currentList.map((r) => ({ value: r.id, label: `${r.prenom} ${r.nom}${recipType === 'contact' && r.client?.raison_sociale ? ` (${r.client.raison_sociale})` : ''}` })),
                  ]}
                  onChange={(e) => pickRecipient(e.target.value, currentList)}
                />
              ) : (
                <Input label="Nom du destinataire" value={recipName} onChange={(e) => setRecipName(e.target.value)} placeholder="Jean Dupont" />
              )}
            </div>

            {recipType === 'libre' ? (
              <Input label="Email *" type="email" value={recipEmail} onChange={(e) => setRecipEmail(e.target.value)} placeholder="destinataire@email.fr" />
            ) : (
              recipEmail && <p className="text-xs text-surface-500">Sera envoyé à <strong className="text-surface-700">{recipEmail}</strong></p>
            )}

            <Input label="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Message</label>
              <textarea rows={4} className="input-base resize-none" value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Bonjour, veuillez trouver ci-joint le document..." />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setSendDoc(null)}>Annuler</Button>
              <Button type="submit" isLoading={sending} icon={<Send className="h-4 w-4" />}>Envoyer</Button>
            </div>
          </form>
        )}
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
