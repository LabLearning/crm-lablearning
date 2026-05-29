'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, ChevronDown, ChevronRight, Plus, Trash2,
  FileText, Link as LinkIcon, Save, AlertTriangle, CheckCircle2,
  XCircle, HelpCircle, Minus, Download, Upload, Loader2, ExternalLink, Database,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { initQualiopiAction, updateIndicateurAction, addPreuveAction, removePreuveAction } from './actions'
import {
  CONFORMITE_LABELS, CONFORMITE_COLORS, CRITERE_LABELS,
} from '@/lib/types/qualiopi'
import { formatDate } from '@/lib/utils'
import type { QualiopiIndicateur, QualiopiPreuve, ConformiteNiveau } from '@/lib/types/qualiopi'
import type { CrmEvidence } from './page'

interface QualiopiDashboardProps {
  indicateurs: QualiopiIndicateur[]
  initialized: boolean
  crmEvidence?: Record<number, CrmEvidence[]>
}

const niveauOptions = Object.entries(CONFORMITE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const preuveTypeOptions = [
  { value: 'document', label: 'Document' },
  { value: 'donnee', label: 'Donnée / Indicateur' },
  { value: 'processus', label: 'Processus' },
  { value: 'lien', label: 'Lien externe' },
]

const niveauIcons: Record<ConformiteNiveau, React.ReactNode> = {
  conforme: <CheckCircle2 className="h-4 w-4 text-success-500" />,
  partiellement_conforme: <AlertTriangle className="h-4 w-4 text-warning-500" />,
  non_conforme: <XCircle className="h-4 w-4 text-danger-500" />,
  non_applicable: <Minus className="h-4 w-4 text-surface-400" />,
  non_evalue: <HelpCircle className="h-4 w-4 text-surface-300" />,
}

export function QualiopiDashboard({ indicateurs, initialized, crmEvidence }: QualiopiDashboardProps) {
  const { toast } = useToast()
  const [expandedCritere, setExpandedCritere] = useState<number | null>(1)
  const [editIndicateur, setEditIndicateur] = useState<QualiopiIndicateur | null>(null)
  const [preuveIndicateur, setPreuveIndicateur] = useState<QualiopiIndicateur | null>(null)
  const [isIniting, setIsIniting] = useState(false)

  // Init if needed
  async function handleInit() {
    setIsIniting(true)
    const result = await initQualiopiAction()
    if (result.success) toast('success', 'Indicateurs Qualiopi initialisés')
    else toast('error', result.error || 'Erreur')
    setIsIniting(false)
  }

  // Group by critère
  const byCritere = useMemo(() => {
    const grouped: Record<number, QualiopiIndicateur[]> = {}
    for (let i = 1; i <= 7; i++) grouped[i] = []
    indicateurs.forEach((ind) => {
      if (!grouped[ind.critere]) grouped[ind.critere] = []
      grouped[ind.critere].push(ind)
    })
    return grouped
  }, [indicateurs])

  // Global stats
  const stats = useMemo(() => {
    const total = indicateurs.filter((i) => i.niveau !== 'non_applicable').length
    const conforme = indicateurs.filter((i) => i.niveau === 'conforme').length
    const partiel = indicateurs.filter((i) => i.niveau === 'partiellement_conforme').length
    const nonConforme = indicateurs.filter((i) => i.niveau === 'non_conforme').length
    const nonEvalue = indicateurs.filter((i) => i.niveau === 'non_evalue').length
    const pct = total > 0 ? Math.round((conforme / total) * 100) : 0
    return { total, conforme, partiel, nonConforme, nonEvalue, pct }
  }, [indicateurs])

  // Stats per critère
  function critereStats(critere: number) {
    const inds = byCritere[critere] || []
    const applicable = inds.filter((i) => i.niveau !== 'non_applicable')
    const conf = inds.filter((i) => i.niveau === 'conforme').length
    return {
      total: applicable.length,
      conforme: conf,
      pct: applicable.length > 0 ? Math.round((conf / applicable.length) * 100) : 0,
      hasIssues: inds.some((i) => i.niveau === 'non_conforme'),
    }
  }

  if (!initialized || indicateurs.length === 0) {
    return (
      <div className="text-center py-16">
        <ShieldCheck className="h-12 w-12 text-surface-300 mx-auto mb-4" />
        <h2 className="text-lg font-heading font-semibold text-surface-800 mb-2">Initialiser le suivi Qualiopi</h2>
        <p className="text-sm text-surface-500 mb-6 max-w-md mx-auto">
          Créez les 32 indicateurs Qualiopi pour commencer à évaluer la conformité de votre organisme.
        </p>
        <Button onClick={handleInit} isLoading={isIniting} icon={<ShieldCheck className="h-4 w-4" />}>
          Initialiser les 32 indicateurs
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Conformité Qualiopi</h1>
          <p className="text-surface-500 mt-1 text-sm">7 critères · 32 indicateurs</p>
        </div>
      </div>

      {/* Global progress */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight">Vue d'ensemble</h2>
          <div className="text-2xl font-heading font-bold text-brand-600">{stats.pct}%</div>
        </div>
        <div className="h-2.5 rounded-full bg-surface-100 overflow-hidden mb-4">
          <div className="h-full rounded-full bg-surface-900 transition-all duration-700 ease-out" style={{ width: `${stats.pct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-xl bg-success-50/60">
            <div className="text-xl font-heading font-bold text-success-600">{stats.conforme}</div>
            <div className="text-[11px] text-success-700">Conformes</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-warning-50/60">
            <div className="text-xl font-heading font-bold text-warning-600">{stats.partiel}</div>
            <div className="text-[11px] text-warning-700">Partiels</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-danger-50/60">
            <div className="text-xl font-heading font-bold text-danger-600">{stats.nonConforme}</div>
            <div className="text-[11px] text-danger-700">Non conformes</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-surface-100">
            <div className="text-xl font-heading font-bold text-surface-500">{stats.nonEvalue}</div>
            <div className="text-[11px] text-surface-500">Non évalués</div>
          </div>
        </div>
      </div>

      {/* Criteria accordion */}
      <div className="space-y-3">
        {Object.entries(byCritere).map(([critereStr, inds]) => {
          const critere = parseInt(critereStr)
          const cs = critereStats(critere)
          const isExpanded = expandedCritere === critere

          return (
            <div key={critere} className="card overflow-hidden">
              {/* Critère header */}
              <button
                onClick={() => setExpandedCritere(isExpanded ? null : critere)}
                className="flex items-center gap-4 w-full p-5 text-left hover:bg-surface-50/30 transition-colors"
              >
                <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center font-heading font-bold text-sm ${
                  cs.hasIssues ? 'bg-danger-50 text-danger-600' : cs.pct === 100 ? 'bg-success-50 text-success-600' : 'bg-surface-100 text-surface-700'
                }`}>
                  C{critere}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-surface-900 tracking-tight">
                    Critère {critere} — {CRITERE_LABELS[critere]}
                  </div>
                  <div className="text-xs text-surface-400 mt-0.5">
                    {cs.conforme}/{cs.total} indicateurs conformes
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${cs.pct === 100 ? 'bg-success-500' : cs.hasIssues ? 'bg-danger-500' : 'bg-surface-900'}`} style={{ width: `${cs.pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-surface-700 w-10 text-right">{cs.pct}%</span>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-surface-400" /> : <ChevronRight className="h-5 w-5 text-surface-400" />}
                </div>
              </button>

              {/* Indicators */}
              {isExpanded && (
                <div className="border-t border-surface-100">
                  {inds.sort((a, b) => a.indicateur - b.indicateur).map((ind) => (
                    <div key={ind.id} className="flex items-start gap-3 px-5 py-3.5 border-b border-surface-100 last:border-0 hover:bg-surface-50/30">
                      <div className="shrink-0 mt-0.5">{niveauIcons[ind.niveau]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-2xs font-mono text-surface-400">Ind. {ind.indicateur}</span>
                          <Badge variant={CONFORMITE_COLORS[ind.niveau]}>{CONFORMITE_LABELS[ind.niveau]}</Badge>
                        </div>
                        <div className="text-sm text-surface-800 mt-0.5">{ind.libelle}</div>
                        {ind.description && <div className="text-xs text-surface-500 mt-0.5">{ind.description}</div>}
                        {ind.commentaire && (
                          <div className="text-xs text-surface-600 mt-1 p-2 rounded-lg bg-surface-50 italic">
                            {ind.commentaire}
                          </div>
                        )}
                        {/* Preuves count */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-2xs text-surface-400">
                            {ind.preuves?.length || 0} preuve{(ind.preuves?.length || 0) > 1 ? 's' : ''}
                          </span>
                          {ind.date_evaluation && (
                            <span className="text-2xs text-surface-400">
                              Évalué le {formatDate(ind.date_evaluation, { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                        {/* Preuves vivantes produites par le CRM */}
                        {(crmEvidence?.[ind.indicateur] || []).map((ev) => (
                          <a key={ev.href + ev.label} href={ev.href}
                            className="inline-flex items-center gap-1.5 mt-1.5 mr-2 px-2 py-1 rounded-lg bg-brand-50 text-brand-700 text-2xs font-medium hover:bg-brand-100 transition-colors">
                            <Database className="h-3 w-3" /> {ev.label}
                            {ev.count > 0 && <span className="font-bold">· {ev.count}</span>}
                          </a>
                        ))}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setPreuveIndicateur(ind)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Gérer les preuves"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditIndicateur(ind)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Évaluer"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit indicator modal */}
      <Modal isOpen={!!editIndicateur} onClose={() => setEditIndicateur(null)} title={editIndicateur ? `Indicateur ${editIndicateur.indicateur}` : ''}>
        {editIndicateur && <IndicateurEvalForm indicateur={editIndicateur} onDone={() => setEditIndicateur(null)} />}
      </Modal>

      {/* Preuves modal */}
      <Modal isOpen={!!preuveIndicateur} onClose={() => setPreuveIndicateur(null)} title={preuveIndicateur ? `Preuves — Indicateur ${preuveIndicateur.indicateur}` : ''} size="lg">
        {preuveIndicateur && <PreuvesManager indicateur={preuveIndicateur} crmEvidence={crmEvidence?.[preuveIndicateur.indicateur]} />}
      </Modal>
    </div>
  )
}

// ---- Indicator Evaluation Form ----

function IndicateurEvalForm({ indicateur, onDone }: { indicateur: QualiopiIndicateur; onDone: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [niveau, setNiveau] = useState<ConformiteNiveau>(indicateur.niveau)
  const [commentaire, setCommentaire] = useState(indicateur.commentaire || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const result = await updateIndicateurAction(indicateur.id, niveau, commentaire)
    if (result.success) { toast('success', 'Évaluation enregistrée'); onDone() }
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl bg-surface-50">
        <div className="text-sm font-medium text-surface-800">{indicateur.libelle}</div>
        {indicateur.preuves_attendues && (
          <div className="text-xs text-surface-500 mt-1">
            <strong>Preuves attendues :</strong> {indicateur.preuves_attendues}
          </div>
        )}
      </div>

      <Select
        id="niveau"
        label="Niveau de conformité"
        options={niveauOptions}
        value={niveau}
        onChange={(e) => setNiveau(e.target.value as ConformiteNiveau)}
      />

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">Commentaire</label>
        <textarea
          rows={4}
          className="input-base resize-none"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Observations, actions à mener, points d'attention..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
      </div>
    </form>
  )
}

// ---- Preuves Manager ----

function PreuvesManager({ indicateur, crmEvidence }: { indicateur: QualiopiIndicateur; crmEvidence?: CrmEvidence[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [addingPreuve, setAddingPreuve] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const preuves = indicateur.preuves || []

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const result = await addPreuveAction(indicateur.id, new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Preuve ajoutée'); setAddingPreuve(false); router.refresh() }
    else toast('error', result.error || 'Erreur')
    setIsSaving(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast('error', 'Fichier trop lourd (max 20 Mo)'); return }
    setUploading(true)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('indicateur_id', indicateur.id)
    fd.set('titre', file.name)
    try {
      const res = await fetch('/api/qualiopi/upload-preuve', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.success) { toast('success', 'Document ajouté au classeur'); router.refresh() }
      else toast('error', data.error || 'Erreur upload')
    } catch { toast('error', 'Erreur réseau') }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleRemove(id: string) {
    if (!confirm('Supprimer cette preuve ?')) return
    const result = await removePreuveAction(id)
    if (result.success) { toast('success', 'Preuve supprimée'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="p-3 rounded-xl bg-surface-50">
        <div className="text-sm font-medium text-surface-800">Ind. {indicateur.indicateur} — {indicateur.libelle}</div>
        {indicateur.preuves_attendues && (
          <div className="text-xs text-surface-500 mt-1">Preuves attendues : {indicateur.preuves_attendues}</div>
        )}
      </div>

      {/* Preuves vivantes du CRM */}
      {(crmEvidence || []).length > 0 && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <div className="text-2xs font-semibold text-brand-700 uppercase tracking-wider mb-2">Déjà dans le CRM</div>
          <div className="flex flex-wrap gap-2">
            {(crmEvidence || []).map((ev) => (
              <a key={ev.href + ev.label} href={ev.href}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-brand-100 text-brand-700 text-xs font-medium hover:bg-brand-50 transition-colors">
                <Database className="h-3.5 w-3.5" /> {ev.label}{ev.count > 0 && <span className="font-bold">· {ev.count}</span>}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-surface-700">{preuves.length} preuve{preuves.length > 1 ? 's' : ''}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} isLoading={uploading}
            icon={<Upload className="h-3.5 w-3.5" />}>Uploader un fichier</Button>
          <Button size="sm" onClick={() => setAddingPreuve(true)} icon={<LinkIcon className="h-3.5 w-3.5" />}>Lien / note</Button>
        </div>
      </div>
      <input ref={fileRef} type="file" className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={handleUpload} />

      {addingPreuve && (
        <form onSubmit={handleAdd} className="card p-4 space-y-3 border-brand-200 border">
          <Input name="titre" label="Titre de la preuve *" placeholder="Convention de formation signée" />
          <div className="grid grid-cols-2 gap-3">
            <Select name="type" label="Type" options={preuveTypeOptions} defaultValue="lien" />
            <Input name="lien_externe" label="Lien (optionnel)" placeholder="https://..." />
          </div>
          <textarea name="description" rows={2} className="input-base resize-none" placeholder="Description..." />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => setAddingPreuve(false)}>Annuler</Button>
            <Button size="sm" type="submit" isLoading={isSaving}>Ajouter</Button>
          </div>
        </form>
      )}

      {preuves.length > 0 ? (
        <div className="space-y-2">
          {preuves.map((p) => {
            const url = p.signed_url || p.lien_externe
            return (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
              <div className={`shrink-0 p-2 rounded-lg ${p.document_url ? 'bg-brand-50' : p.lien_externe ? 'bg-purple-50' : 'bg-surface-100'}`}>
                {p.document_url ? <FileText className="h-4 w-4 text-brand-600" /> : <LinkIcon className="h-4 w-4 text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-800 truncate">{p.titre}</div>
                {p.description && <div className="text-xs text-surface-500 truncate">{p.description}</div>}
                <div className="text-2xs text-surface-400 mt-0.5">{formatDate(p.date_preuve, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 shrink-0" title="Ouvrir / télécharger">
                  <Download className="h-4 w-4" />
                </a>
              )}
              {p.est_valide && <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />}
              <button onClick={() => handleRemove(p.id)} className="p-1 text-surface-400 hover:text-danger-500 shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )})}
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-surface-400">Aucune preuve enregistrée</div>
      )}
    </div>
  )
}
