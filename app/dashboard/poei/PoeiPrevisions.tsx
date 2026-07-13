'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Building2, CalendarClock, Rocket, Pencil, Trash2, ExternalLink, Save,
} from 'lucide-react'
import { Button, Modal, Input, Select, useToast, RowMenu } from '@/components/ui'
import {
  createPoeiPrevisionAction, updatePoeiPrevisionAction,
  updatePrevisionStatutAction, deletePoeiPrevisionAction, transformerPrevisionAction,
} from './prevision-actions'
import {
  PREVISION_STATUT_LABELS, RECRUTEMENT_STATUT_LABELS, COMPTE_FT_STATUT_LABELS,
} from '@/lib/types/poei'
import type { PoeiPrevision } from '@/lib/types/poei'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  previsions: PoeiPrevision[]
  clients: { id: string; raison_sociale: string | null }[]
}

// Couleurs des selects de statut inline
const STATUT_CLS: Record<string, string> = {
  a_planifier: 'bg-surface-100 text-surface-700',
  en_preparation: 'bg-blue-50 text-blue-700',
  pret: 'bg-emerald-50 text-emerald-700',
  transforme: 'bg-surface-100 text-surface-400',
  abandonne: 'bg-rose-50 text-rose-700',
}
const RECRUT_CLS: Record<string, string> = {
  a_lancer: 'bg-surface-100 text-surface-700',
  annonce_en_ligne: 'bg-amber-50 text-amber-700',
  entretiens: 'bg-blue-50 text-blue-700',
  candidats_trouves: 'bg-emerald-50 text-emerald-700',
}
const FT_CLS: Record<string, string> = {
  non_cree: 'bg-surface-100 text-surface-700',
  en_cours: 'bg-amber-50 text-amber-700',
  cree: 'bg-emerald-50 text-emerald-700',
}

function StatutSelect({
  value, labels, colors, onChange, disabled,
}: {
  value: string
  labels: Record<string, string>
  colors: Record<string, string>
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'appearance-none text-xs font-semibold rounded-full px-2.5 py-1 pr-6 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-surface-300 disabled:cursor-default',
        colors[value] || 'bg-surface-100 text-surface-700',
      )}
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2378716C%27 stroke-width=%273%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
    >
      {Object.entries(labels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function PrevisionForm({
  prevision, clients, onDone,
}: {
  prevision?: PoeiPrevision
  clients: Props['clients']
  onDone: () => void
}) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const clientOptions = [
    { value: '', label: 'Aucun (client créé à la transformation)' },
    ...clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id })),
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = prevision
      ? await updatePoeiPrevisionAction(prevision.id, fd)
      : await createPoeiPrevisionAction(fd)
    if (result.success) { toast('success', prevision ? 'Prévision mise à jour' : 'POEI à planifier ajouté'); onDone() }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="entreprise" name="entreprise" label="Société *" placeholder="Nom de l'enseigne / société" defaultValue={prevision?.entreprise || ''} error={errors.entreprise?.[0]} />
      <Select id="client_id" name="client_id" label="Client existant (optionnel)" options={clientOptions} defaultValue={prevision?.client_id || ''} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="date_ouverture_prevue" name="date_ouverture_prevue" type="date" label="Ouverture prévue" defaultValue={prevision?.date_ouverture_prevue || ''} />
        <Input id="date_debut_formation_prevue" name="date_debut_formation_prevue" type="date" label="Début formation prévu" defaultValue={prevision?.date_debut_formation_prevue || ''} />
      </div>
      <Input id="nb_candidats_prevus" name="nb_candidats_prevus" type="number" label="Nombre de candidats prévus" defaultValue={prevision?.nb_candidats_prevus != null ? String(prevision.nb_candidats_prevus) : ''} />
      <textarea id="notes" name="notes" rows={3} className="input-base resize-none" placeholder="Notes (contexte, contact, contraintes…)" defaultValue={prevision?.notes || ''} />
      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">
          {prevision ? 'Mettre à jour' : 'Ajouter'}
        </Button>
      </div>
    </form>
  )
}

export function PoeiPrevisions({ previsions, clients }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editPrevision, setEditPrevision] = useState<PoeiPrevision | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const { actives, closed } = useMemo(() => ({
    actives: previsions.filter((p) => !['transforme', 'abandonne'].includes(p.statut)),
    closed: previsions.filter((p) => ['transforme', 'abandonne'].includes(p.statut)),
  }), [previsions])

  const rows = showClosed ? [...actives, ...closed] : actives

  async function handleStatut(id: string, field: string, value: string) {
    const result = await updatePrevisionStatutAction(id, field, value)
    if (result.success) router.refresh()
    else toast('error', result.error || 'Erreur')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce POEI à planifier ?')) return
    const result = await deletePoeiPrevisionAction(id)
    if (result.success) { toast('success', 'Supprimé'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  async function handleTransformer(p: PoeiPrevision) {
    if (!confirm(`Transformer « ${p.entreprise} » en projet POEI ?${p.client_id ? '' : '\nUn client sera créé automatiquement.'}`)) return
    const result = await transformerPrevisionAction(p.id)
    if (result.success && (result.data as any)?.poeiId) {
      toast('success', 'Projet POEI créé — complétez la formation et les candidats')
      router.push(`/dashboard/poei/${(result.data as any).poeiId}`)
    } else {
      toast('error', result.error || 'Erreur')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-surface-500">
          {actives.length} à suivre
          {closed.length > 0 && (
            <button onClick={() => setShowClosed(!showClosed)} className="ml-2 text-xs text-surface-400 hover:text-surface-600 underline underline-offset-2">
              {showClosed ? 'masquer' : 'afficher'} les {closed.length} transformé{closed.length > 1 ? 's' : ''}/abandonné{closed.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">
          POEI à planifier
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <CalendarClock className="h-8 w-8 text-surface-300 mx-auto mb-3" />
          <div className="text-sm text-surface-500">Aucun POEI à planifier.</div>
          <div className="text-xs text-surface-400 mt-1">Ajoutez les ouvertures à venir pour suivre le recrutement et la création des comptes France Travail.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Société</th>
                  <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Ouverture prévue</th>
                  <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Début formation</th>
                  <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Recrutement</th>
                  <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Compte FT</th>
                  <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">État</th>
                  <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((p) => {
                  const done = ['transforme', 'abandonne'].includes(p.statut)
                  return (
                    <tr key={p.id} className={cn('hover:bg-surface-50/50 transition-colors', done && 'opacity-60')}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-sky-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-surface-900 truncate">{p.entreprise}</div>
                            <div className="text-xs text-surface-400">
                              {p.nb_candidats_prevus ? `${p.nb_candidats_prevus} candidat${p.nb_candidats_prevus > 1 ? 's' : ''} prévu${p.nb_candidats_prevus > 1 ? 's' : ''}` : ''}
                              {p.statut === 'transforme' && p.poei_id && (
                                <Link href={`/dashboard/poei/${p.poei_id}`} className="inline-flex items-center gap-0.5 text-sky-600 hover:underline ml-1">
                                  Voir le projet <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-surface-600">
                        {p.date_ouverture_prevue ? formatDate(p.date_ouverture_prevue) : <span className="text-surface-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-surface-600">
                        {p.date_debut_formation_prevue ? formatDate(p.date_debut_formation_prevue) : <span className="text-surface-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatutSelect value={p.recrutement_statut} labels={RECRUTEMENT_STATUT_LABELS} colors={RECRUT_CLS} disabled={done}
                          onChange={(v) => handleStatut(p.id, 'recrutement_statut', v)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatutSelect value={p.compte_ft_statut} labels={COMPTE_FT_STATUT_LABELS} colors={FT_CLS} disabled={done}
                          onChange={(v) => handleStatut(p.id, 'compte_ft_statut', v)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatutSelect value={p.statut} labels={PREVISION_STATUT_LABELS} colors={STATUT_CLS} disabled={p.statut === 'transforme'}
                          onChange={(v) => handleStatut(p.id, 'statut', v)} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-block">
                          <RowMenu width={220} items={[
                            { label: 'Transformer en projet POEI', icon: <Rocket className="h-4 w-4 text-sky-600" />, onClick: () => handleTransformer(p), hidden: done },
                            { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditPrevision(p) },
                            { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(p.id) },
                          ]} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="POEI à planifier">
        <PrevisionForm clients={clients} onDone={() => setCreateOpen(false)} />
      </Modal>
      <Modal isOpen={!!editPrevision} onClose={() => setEditPrevision(null)} title="Modifier le POEI à planifier">
        {editPrevision && <PrevisionForm prevision={editPrevision} clients={clients} onDone={() => setEditPrevision(null)} />}
      </Modal>
    </div>
  )
}
