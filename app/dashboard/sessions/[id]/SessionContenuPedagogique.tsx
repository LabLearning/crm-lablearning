'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Download, Trash2, Loader2, FileText, Paperclip, Save, Eye,
  BookOpen, Wrench, ListChecks, CheckCircle2, Clock, FileDown,
} from '@/components/ui/icons'
import { Button, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import {
  DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES_SUPPORT,
  DOCUMENT_VISIBILITE_LABELS, DOCUMENT_VISIBILITE_SHORT,
  type DocumentVisibilite,
} from '@/lib/types/document'
import { cn, formatDate } from '@/lib/utils'
import {
  updateDeroulePedagogiqueAction, addSessionSupportAction,
  updateSupportVisibiliteAction, deleteSessionSupportAction,
} from './actions'

interface Support {
  id: string
  nom: string
  type: string
  description: string | null
  file_name: string | null
  file_size: number | null
  storage_path: string | null
  visibilite: DocumentVisibilite
  created_at: string
}

interface PositionnementRow {
  apprenant_id: string
  prenom: string
  nom: string
  fait: boolean
  score: number | null
  completed_at: string | null
  qcm_titre: string | null
}

interface Props {
  sessionId: string
  formationId: string | null
  deroule: string | null
  materiel: string | null
  supports: Support[]
  positionnement: PositionnementRow[]
  apprenants: { id: string; prenom: string; nom: string }[]
}

const typeOptions = DOCUMENT_TYPES_SUPPORT.map((v) => ({ value: v, label: DOCUMENT_TYPE_LABELS[v] }))
const visibiliteOptions = (['formateur', 'stagiaires', 'tous'] as DocumentVisibilite[])
  .map((v) => ({ value: v, label: DOCUMENT_VISIBILITE_LABELS[v] }))

const VISIBILITE_STYLES: Record<DocumentVisibilite, string> = {
  formateur: 'bg-surface-100 text-surface-600',
  stagiaires: 'bg-blue-50 text-blue-700',
  tous: 'bg-emerald-50 text-emerald-700',
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export function SessionContenuPedagogique({
  sessionId, formationId, deroule, materiel, supports, positionnement, apprenants,
}: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Déroulé pédagogique
  const [derouleValue, setDerouleValue] = useState(deroule || '')
  const [materielValue, setMaterielValue] = useState(materiel || '')
  const [savingDeroule, setSavingDeroule] = useState(false)
  const dirty = derouleValue !== (deroule || '') || materielValue !== (materiel || '')

  // Téléversement d'un support
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploaded, setUploaded] = useState<{ storage_path: string; file_name: string; file_size: number; mime_type: string } | null>(null)
  const [nom, setNom] = useState('')
  const [type, setType] = useState<string>('support_pedagogique')
  const [visibilite, setVisibilite] = useState<string>('formateur')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // dragenter/dragleave se déclenchent aussi sur les enfants : on compte les
  // entrées pour ne retirer le surlignage qu'en sortant vraiment de la zone
  const dragDepth = useRef(0)

  function resetDrag() {
    dragDepth.current = 0
    setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    resetDrag()
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); dragDepth.current += 1; setDragging(true) },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current -= 1
      if (dragDepth.current <= 0) resetDrag()
    },
    onDrop: handleDrop,
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
      if (!nom) setNom((file.name || '').replace(/\.[^.]+$/, ''))
    } catch {
      toast('error', 'Erreur lors du transfert')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Déposer un fichier sur la carte ouvre directement la fenêtre, fichier déjà transféré
  function handleDropOnCard(e: React.DragEvent) {
    e.preventDefault()
    resetDrag()
    const file = e.dataTransfer.files?.[0]
    if (!file || uploading) return
    setOpen(true)
    handleFile(file)
  }

  function closeModal() {
    setOpen(false); setUploaded(null); setNom('')
    setType('support_pedagogique'); setVisibilite('formateur')
  }

  async function handleSaveSupport() {
    if (!nom.trim()) { toast('error', 'Donnez un nom au support'); return }
    if (!uploaded) { toast('error', 'Ajoutez un fichier'); return }
    setSaving(true)
    const fd = new FormData()
    fd.set('session_id', sessionId)
    fd.set('nom', nom.trim())
    fd.set('type', type)
    fd.set('visibilite', visibilite)
    fd.set('storage_path', uploaded.storage_path)
    fd.set('file_name', uploaded.file_name)
    fd.set('file_size', String(uploaded.file_size))
    fd.set('mime_type', uploaded.mime_type)
    const r = await addSessionSupportAction(fd)
    setSaving(false)
    if (r.success) { toast('success', 'Support ajouté'); closeModal(); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  function handleSaveDeroule() {
    setSavingDeroule(true)
    startTransition(async () => {
      const r = await updateDeroulePedagogiqueAction(sessionId, derouleValue, materielValue)
      setSavingDeroule(false)
      if (r.success) { toast('success', 'Déroulé enregistré'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  function handleVisibilite(id: string, value: DocumentVisibilite) {
    startTransition(async () => {
      const r = await updateSupportVisibiliteAction(id, value)
      if (r.success) router.refresh()
      else toast('error', r.error || 'Erreur')
    })
  }

  async function handleDeleteSupport(id: string, nomDoc: string) {
    if (!confirm(`Supprimer le support « ${nomDoc} » ?`)) return
    const r = await deleteSessionSupportAction(id)
    if (r.success) { toast('success', 'Support supprimé'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }


  return (
    <div className="space-y-4">
      {/* ─── Supports téléversés ─── */}
      <div
        {...dragHandlers}
        onDrop={open ? handleDrop : handleDropOnCard}
        className={cn('card overflow-hidden transition-colors', dragging && !open && 'ring-2 ring-brand-300 ring-offset-2')}
      >
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-500" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Supports de la session ({supports.length})
            </span>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 min-h-[40px] px-2 -mr-2 sm:min-h-0 sm:px-0 sm:mr-0 rounded-lg text-xs font-medium text-brand-600 hover:text-brand-700">
            <Upload className="h-3.5 w-3.5" /> Téléverser
          </button>
        </div>

        {dragging && !open ? (
          <div className="px-4 py-8 text-center text-sm font-medium text-brand-700 bg-brand-50/60">
            Déposez le fichier pour l&apos;ajouter à cette session
          </div>
        ) : supports.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-surface-400">
            Aucun support. Glissez un fichier ici ou cliquez sur « Téléverser » :
            support de cours, diaporama, exercices…
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {supports.map((d) => (
              <div key={d.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-surface-50/60 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-surface-500" />
                </div>
                <div className="flex-1 min-w-0 basis-[calc(100%-3rem)] sm:basis-auto">
                  <div className="text-sm font-medium text-surface-900 [overflow-wrap:anywhere] sm:truncate">{d.nom}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-surface-500">
                    <span>{(DOCUMENT_TYPE_LABELS as any)[d.type] || d.type}</span>
                    {d.file_name && (
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-[160px]">{d.file_name}</span>
                        {d.file_size ? <span className="text-surface-400">· {fmtSize(d.file_size)}</span> : null}
                      </span>
                    )}
                  </div>
                </div>
                {/* Visibilité modifiable directement dans la liste ; sur mobile, la rangée passe sous le titre */}
                <div className="shrink-0 flex items-center gap-1.5 flex-1 sm:flex-none pl-12 sm:pl-0">
                  <Eye className={cn('h-3.5 w-3.5 shrink-0',
                    d.visibilite === 'tous' ? 'text-emerald-600' : d.visibilite === 'stagiaires' ? 'text-blue-600' : 'text-surface-400')} />
                  <select
                    value={d.visibilite}
                    disabled={isPending}
                    onChange={(e) => handleVisibilite(d.id, e.target.value as DocumentVisibilite)}
                    title={DOCUMENT_VISIBILITE_LABELS[d.visibilite]}
                    className={cn('text-xs font-medium rounded-lg px-2 py-2 sm:py-1 min-h-[40px] sm:min-h-0 border-0 focus:outline-none focus:ring-2 focus:ring-brand-200 cursor-pointer',
                      VISIBILITE_STYLES[d.visibilite])}
                  >
                    {(['formateur', 'stagiaires', 'tous'] as DocumentVisibilite[]).map((v) => (
                      <option key={v} value={v}>{DOCUMENT_VISIBILITE_SHORT[v]}</option>
                    ))}
                  </select>
                </div>
                {d.storage_path && (
                  <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer" title="Télécharger"
                    className="p-2.5 sm:p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 shrink-0">
                    <Download className="h-4 w-4" />
                  </a>
                )}
                <div className="shrink-0">
                  <RowMenu triggerClassName="p-2.5 sm:p-1.5" items={[
                    { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDeleteSupport(d.id, d.nom) },
                  ]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fenêtre de téléversement */}
      <Modal isOpen={open} onClose={closeModal} title="Téléverser un support" size="md">
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
            <button
              type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              {...dragHandlers}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors disabled:opacity-50',
                dragging ? 'border-brand-400 bg-brand-50/60 text-brand-700' : 'border-surface-300 text-surface-500 hover:border-brand-300 hover:bg-brand-50/30',
              )}
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span className="text-sm font-medium">
                {uploading ? 'Transfert en cours…' : dragging ? 'Déposez le fichier ici' : 'Glissez un fichier ici ou cliquez pour le choisir'}
              </span>
              <span className={cn('text-xs', dragging ? 'text-brand-500' : 'text-surface-400')}>
                PDF, diaporama, image · 20 Mo max
              </span>
            </button>
          )}

          <Input id="nom" label="Titre du support *" value={nom} onChange={(e) => setNom(e.target.value)}
            placeholder="Support de cours module 1, Diaporama HACCP…" />
          <Select id="type" label="Type" options={typeOptions} value={type} onChange={(e) => setType(e.target.value)} />
          <Select id="visibilite" label="Visibilité" options={visibiliteOptions} value={visibilite}
            onChange={(e) => setVisibilite(e.target.value)} />
          <p className="text-xs text-surface-400 -mt-2">
            « Formateur uniquement » reste invisible pour les stagiaires et le client.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <Button variant="secondary" onClick={closeModal}>Annuler</Button>
            <Button onClick={handleSaveSupport} isLoading={saving} disabled={!uploaded || !nom.trim()} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
