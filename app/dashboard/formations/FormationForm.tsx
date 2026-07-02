'use client'

import { useState, useRef } from 'react'
import { Save, ChevronDown, ChevronRight, Sparkles, Loader2, List } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { createFormationAction, updateFormationAction } from './actions'
import { MODALITE_LABELS } from '@/lib/types/formation'
import type { Formation } from '@/lib/types/formation'

interface FormationFormProps {
  formation?: Formation
  onSuccess: () => void
  onCancel: () => void
}

const modaliteOptions = Object.entries(MODALITE_LABELS).map(([v, l]) => ({ value: v, label: l }))

// Textarea éditable avec support des puces (bouton + continuation auto sur Entrée).
// Non contrôlé (defaultValue + name) → compatible avec le remplissage par l'IA.
function BulletTextarea({ id, name, label, rows = 3, placeholder, defaultValue, hint }: {
  id: string; name: string; label?: string; rows?: number; placeholder?: string; defaultValue?: string; hint?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function addBullet() {
    const ta = ref.current
    if (!ta) return
    ta.focus()
    const val = ta.value
    const pos = ta.selectionStart
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1
    // Ne pas dupliquer si la ligne commence déjà par une puce
    if (/^\s*•/.test(val.slice(lineStart))) return
    ta.value = val.slice(0, lineStart) + '• ' + val.slice(lineStart)
    const newPos = pos + 2
    ta.setSelectionRange(newPos, newPos)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return
    const ta = e.currentTarget
    const val = ta.value
    const pos = ta.selectionStart
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1
    const currentLine = val.slice(lineStart, pos)
    if (!/^\s*•/.test(currentLine)) return
    e.preventDefault()
    if (currentLine.trim() === '•') {
      // Puce vide → on termine la liste (retire la puce)
      ta.value = val.slice(0, lineStart) + val.slice(pos)
      ta.setSelectionRange(lineStart, lineStart)
    } else {
      const insert = '\n• '
      ta.value = val.slice(0, pos) + insert + val.slice(pos)
      const newPos = pos + insert.length
      ta.setSelectionRange(newPos, newPos)
    }
  }

  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-surface-700 mb-1">{label}</label>}
      <div className="relative">
        <textarea
          ref={ref}
          id={id}
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          className="input-base resize-none w-full pr-16"
        />
        <button
          type="button"
          onClick={addBullet}
          title="Ajouter une puce"
          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium text-surface-500 bg-surface-100 hover:bg-surface-200 hover:text-surface-700 transition-colors"
        >
          <List className="h-3 w-3 shrink-0" /> Puce
        </button>
      </div>
      {hint && <p className="text-2xs text-surface-400 mt-1">{hint}</p>}
    </div>
  )
}

export function FormationForm({ formation, onSuccess, onCancel }: FormationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [sections, setSections] = useState({
    programme: true, pedagogie: false, tarifs: false, certification: false,
  })

  async function handleAIGenerate() {
    const form = formRef.current
    if (!form) return
    const intitule = (form.querySelector('#intitule') as HTMLInputElement)?.value
    const categorie = (form.querySelector('#categorie') as HTMLInputElement)?.value
    const dureeStr = (form.querySelector('#duree_heures') as HTMLInputElement)?.value
    const modalite = (form.querySelector('#modalite') as HTMLSelectElement)?.value

    if (!intitule) { setError('Renseignez l\'intitulé avant de générer'); return }

    setAiLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/generate-programme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intitule, categorie, duree_heures: parseInt(dureeStr) || 14, modalite }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur IA'); return }

      const p = data.programme
      // Remplir les champs du formulaire
      const setField = (id: string, value: string) => {
        const el = form.querySelector('#' + id) as HTMLTextAreaElement | HTMLInputElement
        if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })) }
      }

      setField('objectifs_pedagogiques', (p.modules || []).flatMap((m: any) => m.objectifs || []).join('\n'))
      setField('prerequis', p.prerequis || '')
      setField('public_vise', p.public_cible || '')
      setField('programme_detaille', (p.modules || []).map((m: any) =>
        `${m.titre} (${m.duree})\n${(m.contenu || []).map((c: string) => `  - ${c}`).join('\n')}`
      ).join('\n\n'))
      setField('competences_visees', (p.modules || []).flatMap((m: any) => m.objectifs || []).slice(0, 6).join('\n'))
      setField('modalites_evaluation', (p.modalites_evaluation || []).join(', '))
      setField('methodes_pedagogiques', (p.moyens_pedagogiques || []).join(', '))

      // Ouvrir les sections
      setSections({ programme: true, pedagogie: true, tarifs: false, certification: false })
    } catch {
      setError('Erreur de génération')
    } finally {
      setAiLoading(false)
    }
  }

  function toggle(key: keyof typeof sections) {
    setSections((s) => ({ ...s, [key]: !s[key] }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({}); setError(null)
    const fd = new FormData(e.currentTarget)
    const result = formation ? await updateFormationAction(formation.id, fd) : await createFormationAction(fd)
    if (result.success) onSuccess()
    else if (result.errors) setErrors(result.errors)
    else setError(result.error || 'Erreur')
    setIsLoading(false)
  }

  function SectionHeader({ label, sectionKey }: { label: string; sectionKey: keyof typeof sections }) {
    const open = sections[sectionKey]
    return (
      <button type="button" onClick={() => toggle(sectionKey)}
        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-surface-500 uppercase tracking-wider py-2 hover:text-surface-700 transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {error && <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>}

      {/* Identification */}
      <div className="grid grid-cols-3 gap-3">
        {formation ? (
          <Input id="reference" name="reference" label="Référence" defaultValue={formation.reference || ''} readOnly className="bg-surface-50 text-surface-500 cursor-not-allowed" />
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700">Référence</label>
            <div className="input-base bg-surface-50 text-surface-400 flex items-center select-none">Générée automatiquement</div>
          </div>
        )}
        <div className="col-span-2">
          <Input id="intitule" name="intitule" label="Intitulé *" defaultValue={formation?.intitule || ''} error={errors.intitule?.[0]} />
        </div>
      </div>
      <Input id="sous_titre" name="sous_titre" label="Sous-titre" defaultValue={formation?.sous_titre || ''} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="categorie" name="categorie" label="Catégorie" placeholder="Management, Bureautique..." defaultValue={formation?.categorie || ''} />
        <Select id="modalite" name="modalite" label="Modalité *" options={modaliteOptions} defaultValue={formation?.modalite || 'presentiel'} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="duree_heures" name="duree_heures" type="number" label="Durée (heures) *" defaultValue={formation?.duree_heures?.toString() || ''} error={errors.duree_heures?.[0]} />
        <Input id="duree_jours" name="duree_jours" type="number" label="Durée (jours)" defaultValue={formation?.duree_jours?.toString() || ''} />
      </div>

      {/* Bouton IA */}
      <button
        type="button"
        onClick={handleAIGenerate}
        disabled={aiLoading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-brand-500 text-white hover:from-violet-600 hover:to-brand-600 disabled:opacity-50 transition-all"
      >
        {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {aiLoading ? 'Génération du programme en cours...' : 'Générer le programme avec l\'IA'}
      </button>

      {/* Programme (Qualiopi) */}
      <SectionHeader label="Programme & objectifs (Qualiopi C2)" sectionKey="programme" />
      {sections.programme && (
        <div className="space-y-3 pl-5 border-l-2 border-brand-100">
          <BulletTextarea id="objectifs_pedagogiques" name="objectifs_pedagogiques" label="Objectifs pédagogiques" rows={4}
            placeholder="Un objectif par ligne..." defaultValue={formation?.objectifs_pedagogiques?.join('\n') || ''}
            hint="Un objectif par ligne. Commencer par un verbe d'action." />
          <BulletTextarea id="prerequis" name="prerequis" label="Prérequis" rows={3}
            placeholder="Aucun / Niveau B2 en français..." defaultValue={formation?.prerequis || ''} />
          <BulletTextarea id="public_vise" name="public_vise" label="Public visé" rows={3}
            placeholder="Managers, responsables d'équipe..." defaultValue={formation?.public_vise || ''} />
          <BulletTextarea id="programme_detaille" name="programme_detaille" label="Programme détaillé" rows={6}
            placeholder="Module 1 : Introduction..." defaultValue={formation?.programme_detaille || ''} />
          <BulletTextarea id="competences_visees" name="competences_visees" label="Compétences visées" rows={3}
            placeholder="Une compétence par ligne" defaultValue={formation?.competences_visees?.join('\n') || ''} />
        </div>
      )}

      {/* Pédagogie */}
      <SectionHeader label="Moyens pédagogiques (Qualiopi C4)" sectionKey="pedagogie" />
      {sections.pedagogie && (
        <div className="space-y-3 pl-5 border-l-2 border-success-100">
          <BulletTextarea id="methodes_pedagogiques" name="methodes_pedagogiques" label="Méthodes pédagogiques" rows={3}
            placeholder="Apports théoriques, études de cas, mises en situation..." defaultValue={formation?.methodes_pedagogiques || ''} />
          <BulletTextarea id="moyens_techniques" name="moyens_techniques" label="Moyens techniques" rows={2}
            placeholder="Salle équipée, vidéoprojecteur, PC..." defaultValue={formation?.moyens_techniques || ''} />
          <BulletTextarea id="modalites_evaluation" name="modalites_evaluation" label="Modalités d'évaluation" rows={2}
            placeholder="QCM, mise en situation, étude de cas..." defaultValue={formation?.modalites_evaluation || ''} />
          <BulletTextarea id="modalites_admission" name="modalites_admission" label="Modalités d'admission" rows={3}
            placeholder="Analyse du besoin, vérification des prérequis, entretien / positionnement..." defaultValue={(formation as any)?.modalites_admission || ''} />
          <BulletTextarea id="accessibilite_handicap" name="accessibilite_handicap" label="Accessibilité handicap" rows={2}
            placeholder="Locaux accessibles PMR..." defaultValue={formation?.accessibilite_handicap || ''} />
        </div>
      )}

      {/* Tarifs */}
      <SectionHeader label="Tarification" sectionKey="tarifs" />
      {sections.tarifs && (
        <div className="space-y-3 pl-5 border-l-2 border-warning-100">
          <div className="grid grid-cols-3 gap-3">
            <Input id="tarif_inter_ht" name="tarif_inter_ht" type="number" label="Tarif inter (€ HT)" defaultValue={formation?.tarif_inter_ht?.toString() || ''} />
            <Input id="tarif_intra_ht" name="tarif_intra_ht" type="number" label="Tarif intra (€ HT)" defaultValue={formation?.tarif_intra_ht?.toString() || ''} />
            <Input id="tarif_individuel_ht" name="tarif_individuel_ht" type="number" label="Tarif individuel (€ HT)" defaultValue={formation?.tarif_individuel_ht?.toString() || ''} />
          </div>
        </div>
      )}

      {/* Certification */}
      <SectionHeader label="Certification" sectionKey="certification" />
      {sections.certification && (
        <div className="space-y-3 pl-5 border-l-2 border-purple-100">
          <label className="flex items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" name="est_certifiante" value="true" defaultChecked={formation?.est_certifiante} className="rounded border-surface-300" />
            Formation certifiante
          </label>
          <div className="grid grid-cols-3 gap-3">
            <Input id="code_rncp" name="code_rncp" label="Code RNCP" defaultValue={formation?.code_rncp || ''} />
            <Input id="code_rs" name="code_rs" label="Code RS" defaultValue={formation?.code_rs || ''} />
            <Input id="certificateur" name="certificateur" label="Certificateur" defaultValue={formation?.certificateur || ''} />
          </div>
        </div>
      )}

      {/* Publication */}
      <div className="pt-2 space-y-2">
        <label className="flex items-center gap-2 text-sm text-surface-700">
          <input type="checkbox" name="is_published" value="true" defaultChecked={formation?.is_published} className="rounded border-surface-300" />
          Publier dans le catalogue
        </label>
        <label className="flex items-center gap-2 text-sm text-surface-700">
          <input type="checkbox" name="is_poei" value="true" defaultChecked={(formation as any)?.is_poei} className="rounded border-surface-300" />
          Éligible POEI (Préparation Opérationnelle à l'Emploi)
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {formation ? 'Mettre à jour' : 'Créer la formation'}
        </Button>
      </div>
    </form>
  )
}
