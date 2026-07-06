'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Users, FileText, GraduationCap, Pencil, Mail, Send } from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { addPoeiCandidatAction, removePoeiCandidatAction, updateCandidatStatutAction, updatePoeiCandidatAction, sendAttestationsEntreeAction } from '../actions'
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
  const [editCand, setEditCand] = useState<PoeiCandidat | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendingAll, setSendingAll] = useState(false)

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

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editCand) return
    setSaving(true)
    const result = await updatePoeiCandidatAction(editCand.id, poeiId, new FormData(e.currentTarget))
    if (result.success) { toast('success', 'Candidat mis à jour'); setEditCand(null); router.refresh() }
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

  function reportSendResult(r: any) {
    if (!r.success) { toast('error', r.error || 'Erreur'); return }
    const { sent, skipped } = (r.data || {}) as { sent: number; skipped: string[] }
    if (sent > 0) toast('success', `${sent} attestation${sent > 1 ? 's' : ''} envoyée${sent > 1 ? 's' : ''}`)
    if (skipped?.length) toast('error', `Non envoyé (email manquant ou erreur) : ${skipped.join(', ')}`)
    if (!sent && !skipped?.length) toast('error', 'Aucun envoi effectué')
  }

  async function handleSendOne(c: PoeiCandidat) {
    if (!c.apprenant?.email) { toast('error', 'Ce candidat n\'a pas d\'email — modifiez sa fiche d\'abord'); return }
    setSendingId(c.id)
    reportSendResult(await sendAttestationsEntreeAction(poeiId, [c.id]))
    setSendingId(null)
  }

  async function handleSendAll() {
    if (candidats.length === 0) return
    if (!confirm(`Envoyer l'attestation d'entrée en formation par email aux ${candidats.length} candidats ?`)) return
    setSendingAll(true)
    reportSendResult(await sendAttestationsEntreeAction(poeiId, candidats.map((c) => c.id)))
    setSendingAll(false)
  }

  const nom = (c: PoeiCandidat) => `${c.apprenant?.prenom || ''} ${c.apprenant?.nom || ''}`.trim() || '—'

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="section-label">Candidats</span>
          <Badge variant="default" className="!bg-sky-100 !text-sky-700 !border-transparent">{candidats.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {candidats.length > 0 && (
            <Button onClick={handleSendAll} size="sm" variant="secondary" isLoading={sendingAll} icon={<Send className="h-4 w-4" />}>
              Envoyer attestations d&apos;entrée à tous
            </Button>
          )}
          <Button onClick={() => { setErrors({}); setMode('new'); setOpen(true) }} size="sm" icon={<UserPlus className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Ajouter</Button>
        </div>
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
              <button onClick={() => setEditCand(c)} className="flex-1 min-w-0 text-left group">
                <div className="text-sm font-medium text-surface-900 truncate group-hover:text-sky-700 transition-colors">{nom(c)}</div>
                <div className="text-xs text-surface-500 truncate">
                  {[c.apprenant?.email, c.poste_vise, c.type_contrat ? TYPE_CONTRAT_LABELS[c.type_contrat] : null, c.identifiant_ft ? `FT ${c.identifiant_ft}` : null].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
              <button onClick={() => handleSendOne(c)} disabled={sendingId === c.id} title="Envoyer l'attestation d'entrée par email"
                className="p-1.5 rounded-lg text-surface-400 hover:bg-emerald-50 hover:text-emerald-600 shrink-0 disabled:opacity-50">
                <Mail className="h-4 w-4" />
              </button>
              <a href={`/api/pdf/attestation-entree/${c.apprenant_id}?poei=${poeiId}&candidat=${c.id}`} target="_blank" rel="noopener noreferrer" title="Télécharger l'attestation d'entrée" className="p-1.5 rounded-lg text-surface-400 hover:bg-emerald-50 hover:text-emerald-600 shrink-0"><GraduationCap className="h-4 w-4" /></a>
              <a href={`/api/pdf/pdc/${c.id}`} target="_blank" rel="noopener noreferrer" title="Plan de développement de compétences (France Travail)" className="p-1.5 rounded-lg text-surface-400 hover:bg-sky-50 hover:text-sky-600 shrink-0"><FileText className="h-4 w-4" /></a>
              <button onClick={() => setEditCand(c)} title="Modifier" className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 shrink-0"><Pencil className="h-4 w-4" /></button>
              <select value={c.statut} onChange={(e) => handleStatut(c.id, e.target.value)} className="text-xs rounded-lg border border-surface-200 px-2 py-1 bg-white">
                {statutOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => handleRemove(c.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600 shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Ajout */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Ajouter un candidat" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex gap-2 p-1 bg-surface-100 rounded-xl">
            {(['new', 'existing'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-white shadow-sm text-sky-700' : 'text-surface-500'}`}>
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
            <Button type="submit" isLoading={saving} icon={<UserPlus className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Ajouter</Button>
          </div>
        </form>
      </Modal>

      {/* Édition */}
      <Modal isOpen={!!editCand} onClose={() => setEditCand(null)} title="Modifier le candidat" size="md">
        {editCand && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input id="e_prenom" name="prenom" label="Prénom" defaultValue={editCand.apprenant?.prenom || ''} />
              <Input id="e_nom" name="nom" label="Nom *" defaultValue={editCand.apprenant?.nom || ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input id="e_email" name="email" type="email" label="Email" defaultValue={editCand.apprenant?.email || ''} />
              <Input id="e_telephone" name="telephone" label="Téléphone" defaultValue={editCand.apprenant?.telephone || ''} />
            </div>
            <Input id="e_date_naissance" name="date_naissance" type="date" label="Date de naissance" defaultValue={(editCand.apprenant as any)?.date_naissance || ''} />
            <div className="border-t border-surface-100 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input id="e_identifiant_ft" name="identifiant_ft" label="Identifiant France Travail" defaultValue={editCand.identifiant_ft || ''} />
                <Input id="e_poste_vise" name="poste_vise" label="Poste visé" defaultValue={editCand.poste_vise || ''} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select id="e_type_contrat" name="type_contrat" label="Type de contrat" options={contratOptions} defaultValue={editCand.type_contrat || ''} />
                <Input id="e_date_embauche_prevue" name="date_embauche_prevue" type="date" label="Embauche prévue" defaultValue={editCand.date_embauche_prevue || ''} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={() => setEditCand(null)}>Annuler</Button>
              <Button type="submit" isLoading={saving} icon={<Pencil className="h-4 w-4" />}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
