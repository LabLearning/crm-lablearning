'use client'

import { useState } from 'react'
import { Sparkles, AlertTriangle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { Button, Modal, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ExtractedParticipant } from '@/lib/ai'
import { extractParticipantsFromTextAction } from '@/app/dashboard/leads/actions'

export interface ImportRow extends ExtractedParticipant {
  _selected: boolean
  _duplicate: boolean
}

const CONTRAT_VALUES = ['Dirigeant', 'CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', "Demandeur d'emploi", 'Autre']
const NIVEAU_VALUES = [
  'Sans diplôme', 'Niveau 3 (CAP/BEP)', 'Niveau 4 (Bac)', 'Niveau 5 (Bac+2)',
  'Niveau 6 (Licence)', 'Niveau 7 (Master)', 'Niveau 8 (Doctorat)',
]

type FieldKey = keyof ExtractedParticipant

const COLUMNS: { key: FieldKey; label: string; type?: 'date' | 'select'; options?: string[]; width: string }[] = [
  { key: 'civilite', label: 'Civ.', type: 'select', options: ['M.', 'Mme'], width: 'w-20' },
  { key: 'prenom', label: 'Prénom', width: 'w-32' },
  { key: 'nom', label: 'Nom', width: 'w-32' },
  { key: 'email', label: 'Email', width: 'w-52' },
  { key: 'telephone', label: 'Téléphone', width: 'w-32' },
  { key: 'date_naissance', label: 'Naissance', type: 'date', width: 'w-36' },
  { key: 'lieu_naissance', label: 'Lieu de naissance', width: 'w-36' },
  { key: 'numero_securite_sociale', label: 'N° Sécu', width: 'w-40' },
  { key: 'adresse', label: 'Adresse', width: 'w-52' },
  { key: 'code_postal', label: 'CP', width: 'w-24' },
  { key: 'ville', label: 'Ville', width: 'w-32' },
  { key: 'type_contrat', label: 'Contrat', type: 'select', options: CONTRAT_VALUES, width: 'w-36' },
  { key: 'niveau_diplome', label: 'Niveau', type: 'select', options: NIVEAU_VALUES, width: 'w-40' },
  { key: 'poste', label: 'Poste', width: 'w-32' },
]

const PLACEHOLDER = `Collez ici la liste reçue par mail, WhatsApp, Excel…

Exemple :
- Hayat AYTEKIN, née le 12/03/1990 à Istanbul, 06 12 34 56 78, hayat@mail.fr, CDI
- Cynthia Nerriere 05/07/1988 Nantes - CDD - cynthia.n@mail.com`

function normalizeName(prenom?: string | null, nom?: string | null): string {
  return `${prenom || ''} ${nom || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

interface ImportParticipantsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Personnes déjà enregistrées, pour pré-décocher les doublons évidents. */
  existing: { prenom?: string | null; nom?: string | null }[]
  /** Enregistre les lignes validées. Le modal se ferme si la promesse réussit. */
  onConfirm: (rows: ExtractedParticipant[]) => Promise<{ success: boolean; error?: string }>
  title?: string
  description?: string
}

export function ImportParticipantsModal({
  isOpen, onClose, existing, onConfirm,
  title = 'Importer des participants depuis un texte',
  description = "Collez un texte libre : l'IA en extrait les participants, vous vérifiez avant enregistrement.",
}: ImportParticipantsModalProps) {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setText(''); setRows(null); setAnalyzing(false); setSaving(false)
  }

  function handleClose() {
    if (analyzing || saving) return
    reset(); onClose()
  }

  async function handleAnalyze() {
    if (!text.trim()) return
    setAnalyzing(true)
    const res = await extractParticipantsFromTextAction(text)
    if (res.success) {
      const existingNames = new Set(existing.map((e) => normalizeName(e.prenom, e.nom)))
      const extracted = (res.data as ExtractedParticipant[]).map((p) => {
        const duplicate = existingNames.has(normalizeName(p.prenom, p.nom))
        return { ...p, _duplicate: duplicate, _selected: !duplicate }
      })
      setRows(extracted)
      // Succès partiel : la liste était trop longue pour être lue en entier
      if (res.error) toast('info', res.error)
    } else {
      toast('error', res.error || "Impossible d'analyser ce texte")
    }
    setAnalyzing(false)
  }

  function updateField(index: number, key: FieldKey, value: string) {
    setRows((current) => current!.map((r, i) => (i === index ? { ...r, [key]: value } : r)))
  }

  function toggleRow(index: number) {
    setRows((current) => current!.map((r, i) => (i === index ? { ...r, _selected: !r._selected } : r)))
  }

  async function handleConfirm() {
    const selected = (rows || []).filter((r) => r._selected)
    const invalid = selected.filter((r) => !(r.nom || '').trim())
    if (invalid.length > 0) {
      toast('error', 'Chaque participant sélectionné doit avoir un nom')
      return
    }
    setSaving(true)
    const payload = selected.map(({ _selected, _duplicate, ...p }) => p)
    const res = await onConfirm(payload)
    setSaving(false)
    if (res.success) { reset(); onClose() }
    else toast('error', res.error || 'Erreur lors de l\'enregistrement')
  }

  const selectedCount = (rows || []).filter((r) => r._selected).length
  const duplicateCount = (rows || []).filter((r) => r._duplicate).length

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={rows ? undefined : description}
      size="lg"
      className={rows ? 'max-w-6xl' : undefined}
    >
      {!rows ? (
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={12}
            className="input-base w-full resize-y font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>Annuler</Button>
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={!text.trim()}
              isLoading={analyzing}
              icon={<Sparkles className="h-4 w-4" />}
            >
              {analyzing ? 'Analyse en cours…' : 'Analyser le texte'}
            </Button>
          </div>
          {analyzing && (
            <p className="flex items-center gap-2 text-xs text-surface-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              L&apos;IA lit le texte et répartit les informations, cela peut prendre quelques secondes.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 text-surface-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {rows.length} participant{rows.length > 1 ? 's' : ''} détecté{rows.length > 1 ? 's' : ''} · {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
            {duplicateCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {duplicateCount} doublon{duplicateCount > 1 ? 's' : ''} probable{duplicateCount > 1 ? 's' : ''}, décoché{duplicateCount > 1 ? 's' : ''} par défaut
              </span>
            )}
            <span className="text-surface-400">Les champs surlignés n&apos;ont pas été trouvés par l&apos;IA — complétez-les si besoin.</span>
          </div>

          <div className="overflow-x-auto border border-surface-100 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-surface-500 w-10">
                    <span className="sr-only">Sélection</span>
                  </th>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className={cn('px-2 py-2 text-left font-medium text-surface-500 whitespace-nowrap', col.width)}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((row, index) => (
                  <tr key={index} className={cn(!row._selected && 'opacity-50')}>
                    <td className="px-2 py-1.5 align-middle">
                      <input
                        type="checkbox"
                        checked={row._selected}
                        onChange={() => toggleRow(index)}
                        title={row._duplicate ? 'Doublon probable avec un participant existant' : 'Inclure ce participant'}
                        className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500/20"
                      />
                    </td>
                    {COLUMNS.map((col) => {
                      const value = (row[col.key] as string) || ''
                      const missing = !value
                      const base = cn(
                        'w-full rounded-lg border px-2 py-1 text-xs text-surface-900 bg-white',
                        'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
                        missing ? 'border-amber-300 bg-amber-50/60' : 'border-surface-200',
                        col.key === 'nom' && missing && 'border-danger-400 bg-danger-50/60',
                      )
                      return (
                        <td key={col.key} className="px-2 py-1.5">
                          {col.type === 'select' ? (
                            <select
                              value={value}
                              onChange={(e) => updateField(index, col.key, e.target.value)}
                              className={base}
                            >
                              <option value="">—</option>
                              {col.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              type={col.type === 'date' ? 'date' : 'text'}
                              value={value}
                              onChange={(e) => updateField(index, col.key, e.target.value)}
                              className={base}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setRows(null)} icon={<ArrowLeft className="h-4 w-4" />}>
              Modifier le texte
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>Annuler</Button>
              <Button type="button" onClick={handleConfirm} disabled={selectedCount === 0} isLoading={saving}>
                Enregistrer {selectedCount > 0 ? `(${selectedCount})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
