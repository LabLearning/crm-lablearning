'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FolderPlus, FilePlus, Folder, FileText, Download, Trash2, Pencil,
  Home, ChevronRight, Loader2, Upload, Paperclip, Save, Building2, FolderOpen,
} from 'lucide-react'
import { Button, Modal, Input, SearchSelect, useToast, RowMenu } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import {
  listDossierContent, createDossierAction, renameDossierAction,
  deleteDossierAction, saveDocumentInDossierAction, deleteDocumentInDossierAction,
  type DriveDossier, type DriveDocument,
} from './documentation-actions'

interface Props {
  clients: { id: string; raison_sociale: string | null }[]
}

type Crumb = { id: string | null; nom: string }

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export function DocumentationDrive({ clients }: Props) {
  const { toast } = useToast()

  // Fil d'Ariane : pile des dossiers traversés. La racine est toujours en tête.
  const [trail, setTrail] = useState<Crumb[]>([{ id: null, nom: 'Racine' }])
  const current = trail[trail.length - 1]
  const currentId = current.id

  const [loading, setLoading] = useState(true)
  const [dossiers, setDossiers] = useState<DriveDossier[]>([])
  const [documents, setDocuments] = useState<DriveDocument[]>([])

  const load = useCallback(async (dossierId: string | null) => {
    setLoading(true)
    const res = await listDossierContent(dossierId)
    if (res.success) {
      setDossiers((res.data as any).dossiers)
      setDocuments((res.data as any).documents)
    } else {
      toast('error', res.error || 'Erreur de chargement')
      setDossiers([]); setDocuments([])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load(currentId) }, [currentId, load])

  function enterDossier(d: DriveDossier) {
    setTrail((t) => [...t, { id: d.id, nom: d.nom }])
  }
  function goTo(index: number) {
    setTrail((t) => t.slice(0, index + 1))
  }
  function reload() { load(currentId) }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))

  // ─── Nouveau dossier ───────────────────────────────────────────────────────
  const [newOpen, setNewOpen] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newClient, setNewClient] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreateDossier() {
    if (!newNom.trim()) { toast('error', 'Donnez un nom au dossier'); return }
    setCreating(true)
    const fd = new FormData()
    fd.set('nom', newNom.trim())
    if (currentId) fd.set('parent_id', currentId)
    // Le lien client n'est proposé qu'à la racine (un dossier = une société)
    if (!currentId && newClient) fd.set('client_id', newClient)
    const res = await createDossierAction(fd)
    setCreating(false)
    if (res.success) {
      toast('success', 'Dossier créé')
      setNewOpen(false); setNewNom(''); setNewClient('')
      reload()
    } else toast('error', res.error || 'Erreur')
  }

  // ─── Renommer un dossier ─────────────────────────────────────────────────────
  const [renameTarget, setRenameTarget] = useState<DriveDossier | null>(null)
  const [renameNom, setRenameNom] = useState('')
  const [renaming, setRenaming] = useState(false)

  function openRename(d: DriveDossier) { setRenameTarget(d); setRenameNom(d.nom) }
  async function handleRename() {
    if (!renameTarget) return
    if (!renameNom.trim()) { toast('error', 'Nom requis'); return }
    setRenaming(true)
    const res = await renameDossierAction(renameTarget.id, renameNom.trim())
    setRenaming(false)
    if (res.success) { toast('success', 'Dossier renommé'); setRenameTarget(null); reload() }
    else toast('error', res.error || 'Erreur')
  }

  async function handleDeleteDossier(d: DriveDossier) {
    const ok = confirm(
      `Supprimer le dossier « ${d.nom} » ?\n\nATTENTION : tous les sous-dossiers et tous les documents qu'il contient seront supprimés définitivement.`,
    )
    if (!ok) return
    const res = await deleteDossierAction(d.id)
    if (res.success) { toast('success', 'Dossier supprimé'); reload() }
    else toast('error', res.error || 'Erreur')
  }

  // ─── Ajouter un document (upload + enregistrement) ──────────────────────────
  const [docOpen, setDocOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploaded, setUploaded] = useState<{ storage_path: string; file_name: string; file_size: number; mime_type: string } | null>(null)
  const [docNom, setDocNom] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  function resetDrag() { dragDepth.current = 0; setDragging(false) }

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); dragDepth.current += 1; setDragging(true) },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) resetDrag() },
  }

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast('error', data.error || 'Erreur lors du transfert'); return }
      setUploaded(data)
      if (!docNom) setDocNom((file.name || '').replace(/\.[^.]+$/, ''))
    } catch {
      toast('error', 'Erreur lors du transfert')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Glisser-déposer directement sur la zone : ouvre la fenêtre, fichier déjà transféré
  function handleDropOnZone(e: React.DragEvent) {
    e.preventDefault()
    resetDrag()
    if (!currentId || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    setDocOpen(true)
    handleFile(file)
  }
  function handleDropInModal(e: React.DragEvent) {
    e.preventDefault()
    resetDrag()
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function handleSaveDoc() {
    if (!currentId) { toast('error', 'Ouvrez un dossier avant d\'ajouter un document'); return }
    if (!docNom.trim()) { toast('error', 'Donnez un nom au document'); return }
    if (!uploaded) { toast('error', 'Ajoutez un fichier'); return }
    setSaving(true)
    const fd = new FormData()
    fd.set('dossier_id', currentId)
    fd.set('nom', docNom.trim())
    fd.set('storage_path', uploaded.storage_path)
    fd.set('file_name', uploaded.file_name)
    fd.set('file_size', String(uploaded.file_size))
    fd.set('mime_type', uploaded.mime_type)
    const res = await saveDocumentInDossierAction(fd)
    setSaving(false)
    if (res.success) {
      toast('success', 'Document ajouté')
      setDocOpen(false); setUploaded(null); setDocNom('')
      reload()
    } else toast('error', res.error || 'Erreur')
  }

  async function handleDeleteDoc(d: DriveDocument) {
    if (!confirm(`Supprimer le document « ${d.nom} » ?`)) return
    const res = await deleteDocumentInDossierAction(d.id)
    if (res.success) { toast('success', 'Document supprimé'); reload() }
    else toast('error', res.error || 'Erreur')
  }

  const atRoot = currentId === null
  const isEmpty = dossiers.length === 0 && documents.length === 0

  return (
    <div className="space-y-4">
      {/* Barre d'actions + fil d'Ariane */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <nav className="flex items-center gap-1 text-sm min-w-0 overflow-x-auto">
          {trail.map((c, i) => {
            const last = i === trail.length - 1
            return (
              <span key={`${c.id ?? 'root'}-${i}`} className="inline-flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-surface-300 shrink-0" />}
                <button
                  onClick={() => goTo(i)}
                  disabled={last}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors max-w-[180px]',
                    last ? 'text-surface-900 font-medium' : 'text-surface-500 hover:text-surface-800 hover:bg-surface-100',
                  )}
                >
                  {i === 0 ? <Home className="h-3.5 w-3.5 shrink-0" /> : null}
                  <span className="truncate">{c.nom}</span>
                </button>
              </span>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={() => { setNewNom(''); setNewClient(''); setNewOpen(true) }} icon={<FolderPlus className="h-4 w-4" />}>
            Nouveau dossier
          </Button>
          <Button
            onClick={() => { setUploaded(null); setDocNom(''); setDocOpen(true) }}
            icon={<FilePlus className="h-4 w-4" />}
            disabled={atRoot}
            className="!bg-sky-500 hover:!bg-sky-600 disabled:!bg-surface-200 disabled:!text-surface-400"
          >
            Ajouter un document
          </Button>
        </div>
      </div>

      {atRoot && (
        <p className="text-xs text-surface-500">
          Créez un dossier par société à la racine. Les documents s'ajoutent une fois à l'intérieur d'un dossier.
        </p>
      )}

      {/* Zone de contenu (drop = ajout de document dans le dossier courant) */}
      <div
        {...dragHandlers}
        onDrop={handleDropOnZone}
        className={cn(
          'card p-4 sm:p-5 transition-colors min-h-[240px]',
          dragging && !atRoot && !docOpen && 'ring-2 ring-sky-300 ring-offset-2',
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-surface-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : dragging && !atRoot && !docOpen ? (
          <div className="flex flex-col items-center justify-center py-16 text-sky-600">
            <Upload className="h-8 w-8 mb-2" />
            <span className="text-sm font-medium">Déposez le fichier pour l'ajouter à « {current.nom} »</span>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
              <FolderOpen className="h-6 w-6 text-surface-400" />
            </div>
            <p className="text-sm font-medium text-surface-700">
              {atRoot ? 'Aucun dossier société' : 'Ce dossier est vide'}
            </p>
            <p className="text-xs text-surface-400 mt-1 max-w-xs">
              {atRoot
                ? 'Créez un premier dossier pour organiser vos documents par société.'
                : 'Créez un sous-dossier ou ajoutez un document. Vous pouvez aussi glisser un fichier ici.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Sous-dossiers */}
            {dossiers.length > 0 && (
              <div>
                <div className="section-label mb-2">Dossiers ({dossiers.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {dossiers.map((d) => (
                    <div
                      key={d.id}
                      className="group flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-3 py-2.5 hover:border-sky-300 hover:bg-sky-50/40 transition-colors"
                    >
                      <button onClick={() => enterDossier(d)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                          <Folder className="h-4 w-4 text-sky-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-surface-900 truncate">{d.nom}</div>
                          {d.client_id && (
                            <div className="text-xs text-surface-400 inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {clients.find((c) => c.id === d.client_id)?.raison_sociale || 'Société liée'}
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="shrink-0">
                        <RowMenu items={[
                          { label: 'Renommer', icon: <Pencil className="h-4 w-4" />, onClick: () => openRename(d) },
                          { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDeleteDossier(d) },
                        ]} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <div>
                <div className="section-label mb-2">Documents ({documents.length})</div>
                <div className="rounded-xl border border-surface-200 divide-y divide-surface-100 overflow-hidden">
                  {documents.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50/60 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-surface-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 truncate">{d.nom}</div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-surface-500">
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
                        <a
                          href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 shrink-0"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      <div className="shrink-0">
                        <RowMenu items={[
                          { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDeleteDoc(d) },
                        ]} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal : nouveau dossier */}
      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title="Nouveau dossier" size="md">
        <div className="space-y-4">
          <Input
            id="new-dossier-nom" label="Nom du dossier *" value={newNom}
            onChange={(e) => setNewNom(e.target.value)}
            placeholder={atRoot ? 'Nom de la société…' : 'Nom du sous-dossier…'}
            autoFocus
          />
          {atRoot && (
            <div>
              <SearchSelect
                id="new-dossier-client" label="Société liée (optionnel)"
                options={clientOptions} value={newClient} onChange={setNewClient}
                placeholder="Rattacher à une société du CRM…"
              />
              <p className="mt-1 text-xs text-surface-400">Facultatif — permet de relier ce dossier à une fiche client.</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
            <Button variant="secondary" onClick={() => setNewOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateDossier} isLoading={creating} icon={<FolderPlus className="h-4 w-4" />}>Créer</Button>
          </div>
        </div>
      </Modal>

      {/* Modal : renommer un dossier */}
      <Modal isOpen={!!renameTarget} onClose={() => setRenameTarget(null)} title="Renommer le dossier" size="md">
        <div className="space-y-4">
          <Input
            id="rename-dossier-nom" label="Nom du dossier *" value={renameNom}
            onChange={(e) => setRenameNom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>Annuler</Button>
            <Button onClick={handleRename} isLoading={renaming} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* Modal : ajouter un document */}
      <Modal isOpen={docOpen} onClose={() => { setDocOpen(false); setUploaded(null) }} title={`Ajouter un document — ${current.nom}`} size="md">
        <div className="space-y-4">
          <input
            ref={fileRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {uploaded ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="flex-1 text-sm text-emerald-900 truncate">{uploaded.file_name}</span>
              <span className="text-xs text-emerald-700 shrink-0">{fmtSize(uploaded.file_size)}</span>
              <button onClick={() => setUploaded(null)} className="text-xs text-emerald-700 hover:underline shrink-0">Changer</button>
            </div>
          ) : (
            <button
              type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              {...dragHandlers}
              onDrop={handleDropInModal}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors disabled:opacity-50',
                dragging ? 'border-sky-400 bg-sky-50/60 text-sky-700' : 'border-surface-300 text-surface-500 hover:border-sky-300 hover:bg-sky-50/30',
              )}
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="text-sm font-medium">
                {uploading ? 'Transfert en cours…' : dragging ? 'Déposez le fichier ici' : 'Glissez un fichier ici ou cliquez pour le choisir'}
              </span>
              <span className={cn('text-xs', dragging ? 'text-sky-500' : 'text-surface-400')}>PDF, Word, Excel, image — 20 Mo max</span>
            </button>
          )}

          <Input id="doc-nom" label="Nom du document *" value={docNom} onChange={(e) => setDocNom(e.target.value)} placeholder="Nom du document…" />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <Button variant="secondary" onClick={() => { setDocOpen(false); setUploaded(null) }}>Annuler</Button>
            <Button onClick={handleSaveDoc} isLoading={saving} disabled={!uploaded || !docNom.trim()} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
