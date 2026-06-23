'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Users } from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { addPoeiCandidatAction, removePoeiCandidatAction, updateCandidatStatutAction } from '../actions'
import { CANDIDAT_STATUT_LABELS, TYPE_CONTRAT_LABELS } from '@/lib/types/poei'
import type { PoeiCandidat } from '@/lib/types/poei'

interface Props {
  poeiId: string
  candidats: PoeiCandidat[]
  apprenants: { id: string; nom: string | null; prenom: string | null }[]
}

const contratOptions = [{ value: '', label: '—' }, ...Object.entries(TYPE_CONTRAT_LABELS).map(([v, l]) => ({ value: v, label: l as string }))]
const statutOptions = Object.entries(CANDIDAT_STATUT_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function PoeiCandidats({ poeiId, candidats, apprenants }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const apprenantOptions = [{ value: '', label: 'Sélectionner…' }, ...apprenants.map((a) => ({ value: a.id, label: `${a.prenom || ''} ${a.nom || ''}`.trim() || a.id }))]

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    if (mode === 'new') fd.delete('apprenant_id')
    const result = await addPoeiCandidatAction(poeiId, fd)
    if (result.success) { toast('success', 'Candidat ajouté'); setOpen(false); router.refresh() }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setSaving(false)
  }

  async function handleStatut(id: string, statut: string) {
    const r = await updateCandidatStatutAction(id, poeiId, statut)
    if (r.success) router.refresh(); else toast('error', r.error || 'Erreur')
  }

  async function handleRemove(id: string) {
    if (!confirm('Retirer ce candidat du projet ? (la fiche apprenant est conservée)')) return
    const r = await removePoeiCandidatAction(id, poeiId)
    if (r.success) { toast('success', 'Candidat retiré'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  const nom = (c: PoeiCandidat) => `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || '—'

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-label">Candidats</span>
          <Badge variant="default">{candidats.length}</Badge>
        </div>
        <Button onClick={() => { setErrors({}); setMode('new'); setOpen(true) }} size="sm" icon={<UserPlus className="h-4 w-4" />}>Ajouter</Button>
      </div>

      {candidats.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-500">
          <Users className="h-7 w-7 text-surface-300 mx-auto mb-2" />
          Aucun candidat inscrit
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {candidats.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 truncate">{nom(c)}</div>
                <div className="text-xs text-surface-500 truncate">
                  {[c.poste_vise, c.type_contrat ? TYPE_CONTRAT_LABELS[c.type_contrat] : null, c.identifiant_ft ? `FT ${c.identifiant_ft}` : null].filter(Boolean).join(' · ') || c.apprenant?.email || ''}
                </div>
              </div>
              <select value={c.statut} onChange={(e) => handleStatut(c.id, e.target.value)} className="text-xs rounded-lg border border-surface-200 px-2 py-1 bg-white">
                {statutOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => handleRemove(c.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600 shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Ajouter un candidat" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          {/* Toggle nouveau / existant */}
          <div className="flex gap-2 p-1 bg-surface-100 rounded-xl">
            {(['new', 'existing'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500'}`}>
                {m === 'new' ? 'Nouveau candidat' : 'Apprenant existant'}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <Select id="apprenant_id" name="apprenant_id" label="Apprenant" options={apprenantOptions} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input id="prenom" name="prenom" label="Prénom" />
                <Input id="nom" name="nom" label="Nom *" error={errors.nom?.[0]} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input id="email" name="email" type="email" label="Email" />
                <Input id="telephone" name="telephone" label="Téléphone" />
              </div>
            </>
          )}

          <div className="border-t border-surface-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input id="identifiant_ft" name="identifiant_ft" label="Identifiant France Travail" />
              <Input id="poste_vise" name="poste_vise" label="Poste visé" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select id="type_contrat" name="type_contrat" label="Type de contrat" options={contratOptions} />
              <Input id="date_embauche_prevue" name="date_embauche_prevue" type="date" label="Embauche prévue" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={saving} icon={<UserPlus className="h-4 w-4" />}>Ajouter</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
