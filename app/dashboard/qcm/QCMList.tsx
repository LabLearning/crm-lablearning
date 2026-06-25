'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Pencil, Trash2, Copy, Eye,
  ListChecks, CheckCircle2, Circle, X, Send, Save,
  GraduationCap, ChevronDown, ChevronRight, Sparkles, Loader2,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import {
  createQCMAction, updateQCMStatusAction, deleteQCMAction, duplicateQCMAction,
  addQuestionAction, addChoixAction, removeQuestionAction, removeChoixAction,
} from './actions'
import {
  QCM_TYPE_LABELS, QCM_TYPE_COLORS, QCM_TYPE_QUALIOPI,
  QUESTION_TYPE_LABELS, EVALUATION_STATUS_LABELS, EVALUATION_STATUS_COLORS,
} from '@/lib/types/evaluation'
import type { QCM, QCMType, QCMQuestion, QCMChoix, EvaluationStatus } from '@/lib/types/evaluation'
import type { Formation } from '@/lib/types/formation'

interface QCMListProps {
  qcms: QCM[]
  formations: Pick<Formation, 'id' | 'intitule'>[]
}

const typeOptions = Object.entries(QCM_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const questionTypeOptions = Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function QCMList({ qcms, formations }: QCMListProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [builderQCM, setBuilderQCM] = useState<QCM | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const formationOptions = [{ value: '', label: 'Aucune (générique)' }, ...formations.map((f) => ({ value: f.id, label: f.intitule }))]

  const filtered = useMemo(() => {
    return qcms.filter((q) => {
      const matchSearch = q.titre.toLowerCase().includes(search.toLowerCase()) ||
        (q.formation?.intitule || '').toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || q.type === typeFilter
      return matchSearch && matchType
    })
  }, [qcms, search, typeFilter])

  // Count by type
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: qcms.length }
    qcms.forEach((q) => { c[q.type] = (c[q.type] || 0) + 1 })
    return c
  }, [qcms])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createQCMAction(fd)
    if (result.success) {
      toast('success', 'QCM créé')
      setCreateOpen(false)
      setBuilderQCM(result.data as QCM)
    } else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce QCM ?')) return
    const result = await deleteQCMAction(id)
    if (result.success) toast('success', 'QCM supprimé')
    else toast('error', result.error || 'Erreur')
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateQCMAction(id)
    if (result.success) toast('success', 'QCM dupliqué')
    else toast('error', result.error || 'Erreur')
  }

  async function handlePublish(id: string) {
    const result = await updateQCMStatusAction(id, 'publie')
    if (result.success) toast('success', 'QCM publié')
    else toast('error', result.error || 'Erreur')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">QCM & Évaluations</h1>
          <p className="text-surface-500 mt-1 text-sm">Banque de questionnaires — Conformité Qualiopi</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouveau QCM</Button>
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto mb-5">
        {['all', ...Object.keys(QCM_TYPE_LABELS)].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${typeFilter === t ? 'bg-surface-900 text-white shadow-xs' : 'bg-white text-surface-500 border border-surface-200/80 hover:border-surface-300 hover:text-surface-700'}`}>
            {t === 'all' ? 'Tous' : QCM_TYPE_LABELS[t as QCMType]}
            <span className="ml-1 text-surface-400">({counts[t] || 0})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1" />
      </div>

      {/* QCM cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((q) => (
          <div key={q.id} onClick={() => setBuilderQCM(q)} className="card p-5 hover:shadow-card transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-surface-900 line-clamp-2">{q.titre}</h3>
                {q.description && <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{q.description}</p>}
              </div>
              <div className="ml-2" onClick={(e) => e.stopPropagation()}>
                <RowMenu width={192} items={[
                  { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setBuilderQCM(q) },
                  { label: 'Publier', icon: <Send className="h-4 w-4" />, onClick: () => handlePublish(q.id), hidden: q.status !== 'brouillon' },
                  { label: 'Dupliquer', icon: <Copy className="h-4 w-4 text-surface-400" />, onClick: () => handleDuplicate(q.id) },
                  { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(q.id), danger: true },
                ]} />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge variant={QCM_TYPE_COLORS[q.type]}>{QCM_TYPE_LABELS[q.type]}</Badge>
              <Badge variant={EVALUATION_STATUS_COLORS[q.status]}>{EVALUATION_STATUS_LABELS[q.status]}</Badge>
              {q.is_template && <Badge variant="default">Modèle</Badge>}
            </div>

            <div className="text-2xs text-brand-600 font-medium mb-2">{QCM_TYPE_QUALIOPI[q.type]}</div>

            <div className="flex items-center gap-4 text-xs text-surface-500 pt-3 border-t border-surface-100">
              <span className="flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" />
                {q.questions?.length || 0} questions
              </span>
              {q.duree_minutes && <span>{q.duree_minutes} min</span>}
              {q.score_min_reussite && <span>Seuil : {q.score_min_reussite}%</span>}
              {q.formation && (
                <span className="truncate"><GraduationCap className="h-3.5 w-3.5 inline mr-0.5" />{q.formation.intitule}</span>
              )}
            </div>

            {q._reponses_count !== undefined && q._reponses_count > 0 && (
              <div className="text-2xs text-surface-400 mt-2">{q._reponses_count} réponse{q._reponses_count > 1 ? 's' : ''}</div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <ListChecks className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">Aucun QCM trouvé</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau QCM" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input id="titre" name="titre" label="Titre *" placeholder="QCM de positionnement — Management" error={errors.titre?.[0]} />
          <textarea id="description" name="description" rows={2} className="input-base resize-none" placeholder="Description (optionnel)" />
          <div className="grid grid-cols-2 gap-3">
            <Select id="type" name="type" label="Type *" options={typeOptions} defaultValue="positionnement" />
            <Select id="formation_id" name="formation_id" label="Formation liée" options={formationOptions} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input id="duree_minutes" name="duree_minutes" type="number" label="Durée (min)" placeholder="30" />
            <Input id="score_min_reussite" name="score_min_reussite" type="number" label="Score min (%)" placeholder="70" />
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 text-sm text-surface-700 py-2.5">
                <input type="checkbox" name="questions_aleatoires" value="true" className="rounded border-surface-300" />
                Ordre aléatoire
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<ListChecks className="h-4 w-4" />}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* Builder Modal */}
      <Modal isOpen={!!builderQCM} onClose={() => setBuilderQCM(null)} title={`Éditeur — ${builderQCM?.titre || ''}`} size="lg">
        {builderQCM && <QCMBuilder qcm={builderQCM} />}
      </Modal>
    </div>
  )
}

// ---- QCM Builder (question editor) ----

function QCMBuilder({ qcm }: { qcm: QCM }) {
  const { toast } = useToast()
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedQ, setExpandedQ] = useState<string | null>(null)
  const [newChoixText, setNewChoixText] = useState('')
  const [newChoixCorrect, setNewChoixCorrect] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiTheme, setAiTheme] = useState('')
  const [aiNiveau, setAiNiveau] = useState('intermediaire')
  const [aiNb, setAiNb] = useState(5)
  const [showAiForm, setShowAiForm] = useState(false)

  const questions = qcm.questions || []
  const sections = [...new Set(questions.map((q) => q.section).filter(Boolean))]

  async function handleAddQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    fd.set('qcm_id', qcm.id)
    const result = await addQuestionAction(fd)
    if (result.success) {
      toast('success', 'Question ajoutée')
      setAddingQuestion(false)
      setExpandedQ((result.data as QCMQuestion).id)
    } else toast('error', result.error || 'Erreur')
    setIsSaving(false)
  }

  async function handleRemoveQuestion(id: string) {
    if (!confirm('Supprimer cette question ?')) return
    const result = await removeQuestionAction(id)
    if (result.success) toast('success', 'Question supprimée')
    else toast('error', result.error || 'Erreur')
  }

  async function handleAddChoix(questionId: string) {
    if (!newChoixText.trim()) return
    const result = await addChoixAction(questionId, newChoixText.trim(), newChoixCorrect)
    if (result.success) { setNewChoixText(''); setNewChoixCorrect(false) }
    else toast('error', result.error || 'Erreur')
  }

  async function handleRemoveChoix(id: string) {
    const result = await removeChoixAction(id)
    if (!result.success) toast('error', result.error || 'Erreur')
  }

  async function handleAIGenerate() {
    if (!aiTheme.trim()) { toast('error', 'Veuillez saisir un thème'); return }
    setAiGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-qcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formationTitle: qcm.titre,
          theme: aiTheme,
          niveau: aiNiveau,
          nbQuestions: aiNb,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast('error', data.error || 'Erreur IA'); return }

      // Ajouter chaque question générée
      let added = 0
      for (const q of data.questions) {
        const fd = new FormData()
        fd.set('qcm_id', qcm.id)
        fd.set('texte', q.question)
        fd.set('type', 'choix_unique')
        fd.set('points', '1')
        fd.set('explication', q.explication || '')
        fd.set('section', aiTheme)
        const result = await addQuestionAction(fd)
        if (result.success) {
          const questionId = (result.data as QCMQuestion).id
          for (const r of q.reponses) {
            await addChoixAction(questionId, r.texte, r.est_correcte)
          }
          added++
        }
      }
      toast('success', `${added} questions générées par l'IA`)
      setShowAiForm(false)
      setAiTheme('')
    } catch {
      toast('error', 'Erreur de génération')
    } finally {
      setAiGenerating(false)
    }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-surface-500">
          {questions.length} question{questions.length > 1 ? 's' : ''} · {QCM_TYPE_LABELS[qcm.type]}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiForm(!showAiForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-violet-500 to-brand-500 text-white hover:from-violet-600 hover:to-brand-600 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" /> Générer avec l'IA
          </button>
          <Button size="sm" onClick={() => setAddingQuestion(true)} icon={<Plus className="h-3.5 w-3.5" />}>
            Ajouter manuellement
          </Button>
        </div>
      </div>

      {/* Formulaire IA */}
      {showAiForm && (
        <div className="card p-4 space-y-3 border-violet-200 border bg-violet-50/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
            <Sparkles className="h-4 w-4" /> Génération automatique par IA
          </div>
          <input
            type="text"
            value={aiTheme}
            onChange={e => setAiTheme(e.target.value)}
            placeholder="Thème des questions (ex: Hygiène HACCP, Sécurité incendie...)"
            className="input-base text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Niveau</label>
              <select value={aiNiveau} onChange={e => setAiNiveau(e.target.value)} className="input-base text-sm">
                <option value="debutant">Débutant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="avance">Avancé</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Nombre de questions</label>
              <select value={aiNb} onChange={e => setAiNb(Number(e.target.value))} className="input-base text-sm">
                {[3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowAiForm(false)}>Annuler</Button>
            <button
              onClick={handleAIGenerate}
              disabled={aiGenerating || !aiTheme.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-brand-500 text-white hover:from-violet-600 hover:to-brand-600 disabled:opacity-50"
            >
              {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiGenerating ? 'Génération en cours...' : 'Générer'}
            </button>
          </div>
        </div>
      )}

      {/* Add question form */}
      {addingQuestion && (
        <form onSubmit={handleAddQuestion} className="card p-4 space-y-3 border-brand-200 border">
          <textarea name="texte" rows={2} className="input-base resize-none" placeholder="Texte de la question *" required />
          <div className="grid grid-cols-2 gap-3">
            <Select name="type" label="Type" options={questionTypeOptions} defaultValue="choix_unique" />
            <Input name="points" type="number" label="Points" defaultValue="1" />
          </div>
          <Input name="section" label="Section (optionnel)" placeholder="Connaissances générales" />
          <textarea name="explication" rows={2} className="input-base resize-none" placeholder="Explication (affichée après réponse)" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => setAddingQuestion(false)}>Annuler</Button>
            <Button size="sm" type="submit" isLoading={isSaving} icon={<Save className="h-3.5 w-3.5" />}>Ajouter</Button>
          </div>
        </form>
      )}

      {/* Questions list */}
      <div className="space-y-2">
        {questions.sort((a, b) => a.position - b.position).map((q, idx) => (
          <div key={q.id} className="card p-0 overflow-hidden">
            {/* Question header */}
            <button
              onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
              className="flex items-center gap-3 w-full p-3 text-left hover:bg-surface-50 transition-colors"
            >
              <span className="shrink-0 h-6 w-6 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-800 line-clamp-1">{q.texte}</div>
                <div className="text-2xs text-surface-400 mt-0.5">
                  {QUESTION_TYPE_LABELS[q.type]} · {q.points} pt{q.points > 1 ? 's' : ''}
                  {q.section && ` · ${q.section}`}
                </div>
              </div>
              <Badge variant="default">{q.choix?.length || 0} choix</Badge>
              {expandedQ === q.id ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
            </button>

            {/* Expanded: choices */}
            {expandedQ === q.id && (
              <div className="px-3 pb-3 pt-0 border-t border-surface-100">
                {/* Existing choices */}
                {(q.choix || []).length > 0 && (
                  <div className="space-y-1 mb-3 mt-2">
                    {(q.choix || []).sort((a, b) => a.position - b.position).map((c) => (
                      <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${c.est_correct ? 'bg-success-50 border border-success-200' : 'bg-surface-50'}`}>
                        {c.est_correct ? <CheckCircle2 className="h-4 w-4 text-success-600 shrink-0" /> : <Circle className="h-4 w-4 text-surface-300 shrink-0" />}
                        <span className="flex-1">{c.texte}</span>
                        <button onClick={() => handleRemoveChoix(c.id)} className="p-0.5 text-surface-400 hover:text-danger-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add choice (for applicable types) */}
                {['choix_unique', 'choix_multiple'].includes(q.type) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newChoixText}
                      onChange={(e) => setNewChoixText(e.target.value)}
                      placeholder="Nouvelle option..."
                      className="input-base flex-1 py-1.5 text-sm"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChoix(q.id) } }}
                    />
                    <label className="flex items-center gap-1 text-xs text-surface-600 whitespace-nowrap">
                      <input type="checkbox" checked={newChoixCorrect} onChange={(e) => setNewChoixCorrect(e.target.checked)} className="rounded border-surface-300" />
                      Correcte
                    </label>
                    <Button size="sm" variant="secondary" onClick={() => handleAddChoix(q.id)}>+</Button>
                  </div>
                )}

                {q.explication && (
                  <div className="mt-2 p-2 rounded-lg bg-brand-50 text-xs text-brand-700">
                    <strong>Explication :</strong> {q.explication}
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <button onClick={() => handleRemoveQuestion(q.id)} className="text-xs text-danger-500 hover:text-danger-700">
                    Supprimer cette question
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {questions.length === 0 && !addingQuestion && (
        <div className="text-center py-8 text-sm text-surface-400">
          Aucune question. Commencez par ajouter des questions à ce QCM.
        </div>
      )}
    </div>
  )
}
