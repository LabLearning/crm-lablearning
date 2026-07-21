'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderOpen, Upload, Download, Trash2, Loader2, FileText, Paperclip, Save,
} from 'lucide-react'
import { Button, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import { createDocumentAction, deleteDocumentAction } from '@/app/dashboard/documents/actions'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES_ENTREPRISE } from '@/lib/types/document'
import { formatDate } from '@/lib/utils'

interface Doc {
  id: string
  nom: string
  type: string
  description: string | null
  file_name: string | null
  file_size: number | null
  storage_path: string | null
  created_at: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

// Sur une fiche client on ne propose que les pièces administratives de la société —
// les documents de formation (convention, émargement…) vivent sur la session
const typeOptions = DOCUMENT_TYPES_ENTREPRISE.map((v) => ({ value: v, label: DOCUMENT_TYPE_LABELS[v] }))

export function ClientDocuments({ clientId, documents }: { clientId: string; documents: Doc[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploaded, setUploaded] = useState<{ storage_path: string; file_name: string; file_size: number; mime_type: string } | null>(null)
  const [nom, setNom] = useState('')
  const [type, setType] = useState<string>('kbis')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast('error', data.error || 'Erreur lors du transfert'); return }
      setUploaded(data)
      // Nom par défaut : le nom du fichier sans extension
      if (!nom) setNom((file.name || '').replace(/\.[^.]+$/, ''))
    } catch {
      toast('error', 'Erreur lors du transfert')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!nom.trim()) { toast('error', 'Donnez un nom au document'); return }
    if (!uploaded) { toast('error', 'Ajoutez un fichier'); return }
    setSaving(true)
    const fd = new FormData()
    fd.set('nom', nom.trim())
    fd.set('type', type)
    fd.set('client_id', clientId)
    fd.set('storage_path', uploaded.storage_path)
    fd.set('file_name', uploaded.file_name)
    fd.set('file_size', String(uploaded.file_size))
    fd.set('mime_type', uploaded.mime_type)
    const r = await createDocumentAction(fd)
    setSaving(false)
    if (r.success) {
      toast('success', 'Document ajouté')
      setOpen(false); setUploaded(null); setNom(''); setType('kbis')
      router.refresh()
    } else toast('error', r.error || 'Erreur')
  }

  async function handleDelete(id: string, nomDoc: string) {
    if (!confirm(`Supprimer le document « ${nomDoc} » ?`)) return
    const r = await deleteDocumentAction(id)
    if (r.success) { toast('success', 'Document supprimé'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Documents ({documents.length})
          </span>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
          <Upload className="h-3.5 w-3.5" /> Ajouter
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-surface-400">
          Aucun document. Ajoutez ici les pièces liées à l&apos;entreprise : Kbis, courriers OPCO/AKTO, attestations…
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/60 transition-colors">
              <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-surface-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">{d.nom}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-surface-500">
                  <span>{DOCUMENT_TYPE_LABELS[d.type as keyof typeof DOCUMENT_TYPE_LABELS] || d.type}</span>
                  {d.file_name && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[160px]">{d.file_name}</span>
                      {d.file_size ? <span className="text-surface-400">· {fmtSize(d.file_size)}</span> : null}
                    </span>
                  )}
                  <span className="text-surface-400">{formatDate(d.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              {d.storage_path && (
                <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer"
                  title="Télécharger"
                  className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 shrink-0">
                  <Download className="h-4 w-4" />
                </a>
              )}
              <div className="shrink-0">
                <RowMenu items={[
                  { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(d.id, d.nom) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => { setOpen(false); setUploaded(null) }} title="Ajouter un document" size="md">
        <div className="space-y-4">
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {uploaded ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="flex-1 text-sm text-emerald-900 truncate">{uploaded.file_name}</span>
              <span className="text-xs text-emerald-700 shrink-0">{fmtSize(uploaded.file_size)}</span>
              <button onClick={() => setUploaded(null)} className="text-xs text-emerald-700 hover:underline shrink-0">Changer</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-300 py-8 text-surface-500 hover:border-brand-300 hover:bg-brand-50/30 transition-colors disabled:opacity-50">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="text-sm font-medium">{uploading ? 'Transfert en cours…' : 'Choisir un fichier'}</span>
              <span className="text-xs text-surface-400">PDF, Word, Excel, image — 20 Mo max</span>
            </button>
          )}

          <Input id="nom" label="Nom du document *" value={nom} onChange={(e) => setNom(e.target.value)}
            placeholder="Kbis, Courrier AKTO, Attestation URSSAF…" />
          <Select id="type" label="Type" options={typeOptions} value={type} onChange={(e) => setType(e.target.value)} />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <Button variant="secondary" onClick={() => { setOpen(false); setUploaded(null) }}>Annuler</Button>
            <Button onClick={handleSave} isLoading={saving} disabled={!uploaded || !nom.trim()} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
