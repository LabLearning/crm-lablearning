'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserCog, Plus, Pencil, Trash2, Save, Clock, CheckCircle2, XCircle,
  AlertCircle, Calendar, Download,
} from 'lucide-react'
import { Button, Modal, Input, useToast, RowMenu, SearchSelect } from '@/components/ui'
import { addPoeiInterventionAction, updatePoeiInterventionAction, removePoeiInterventionAction } from '../actions'
import { cn, formatDate } from '@/lib/utils'

interface Intervention {
  id: string
  libelle: string
  formateur_id: string | null
  date_debut: string | null
  date_fin: string | null
  nb_heures: number | null
  tarif_journalier: number | null
  montant_ht: number | null
  mission_status: string
  mission_responded_at: string | null
  mission_response_comment: string | null
  notes: string | null
  formateur?: { prenom: string | null; nom: string | null } | null
  contrat?: { id: string; numero: string | null; status: string | null; signature_formateur_date: string | null } | null
}

interface Props {
  poeiId: string
  interventions: Intervention[]
  formateurs: { id: string; prenom: string | null; nom: string | null; tarif_journalier?: number | null; zone_intervention?: string | null }[]
  dureeTotale: number | null
}

const MISSION_META: Record<string, { label: string; cls: string; Icon: any }> = {
  pending: { label: 'En attente de réponse', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  accepted: { label: 'Acceptée', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  refused: { label: 'Refusée', cls: 'bg-rose-50 text-rose-700', Icon: XCircle },
  not_required: { label: 'Formateur à affecter', cls: 'bg-surface-100 text-surface-500', Icon: AlertCircle },
}

function InterventionForm({
  poeiId, intervention, formateurs, onDone,
}: {
  poeiId: string
  intervention?: Intervention
  formateurs: Props['formateurs']
  onDone: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formateurId, setFormateurId] = useState(intervention?.formateur_id || '')

  const options = formateurs.map((f) => ({
    value: f.id,
    label: `${f.prenom || ''} ${f.nom || ''}`.trim() || f.id,
    ...(f.tarif_journalier || f.zone_intervention ? {
      preview: {
        title: `${f.prenom || ''} ${f.nom || ''}`.trim(),
        lines: [
          ...(f.tarif_journalier ? [{ label: 'Tarif journalier', value: `${f.tarif_journalier} €` }] : []),
          ...(f.zone_intervention ? [{ label: 'Zone', value: f.zone_intervention }] : []),
        ],
      },
    } : {}),
  }))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.set('formateur_id', formateurId)
    const r = intervention
      ? await updatePoeiInterventionAction(intervention.id, poeiId, fd)
      : await addPoeiInterventionAction(poeiId, fd)
    if (r.success) {
      toast('success', intervention ? 'Intervention mise à jour' : 'Intervention ajoutée — le formateur est notifié')
      onDone()
    } else if (r.errors) setErrors(r.errors)
    else toast('error', r.error || 'Erreur')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="libelle" name="libelle" label="Intitulé de l'intervention *"
        placeholder="Semaine 1 — Hygiène & HACCP"
        defaultValue={intervention?.libelle || ''} error={errors.libelle?.[0]} />

      <SearchSelect
        id="formateur_id" label="Formateur"
        options={options} value={formateurId} onChange={setFormateurId}
        placeholder="Rechercher un formateur…"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input id="date_debut" name="date_debut" type="date" label="Du" defaultValue={intervention?.date_debut || ''} />
        <Input id="date_fin" name="date_fin" type="date" label="Au" defaultValue={intervention?.date_fin || ''} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input id="nb_heures" name="nb_heures" type="number" label="Heures" defaultValue={intervention?.nb_heures?.toString() || ''} />
        <Input id="tarif_journalier" name="tarif_journalier" type="number" label="Tarif / jour (€)" defaultValue={intervention?.tarif_journalier?.toString() || ''} />
        <Input id="montant_ht" name="montant_ht" type="number" label="Rémunération (€)" defaultValue={intervention?.montant_ht?.toString() || ''} />
      </div>

      <textarea id="notes" name="notes" rows={2} className="input-base resize-none w-full"
        placeholder="Notes (contenu couvert, contraintes…)" defaultValue={intervention?.notes || ''} />

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={loading} icon={<Save className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">
          {intervention ? 'Mettre à jour' : "Ajouter l'intervention"}
        </Button>
      </div>
    </form>
  )
}

export function PoeiInterventions({ poeiId, interventions, formateurs, dureeTotale }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editIv, setEditIv] = useState<Intervention | null>(null)

  const heuresAffectees = interventions.reduce((s, i) => s + (Number(i.nb_heures) || 0), 0)
  const reste = dureeTotale != null ? Number(dureeTotale) - heuresAffectees : null

  async function handleRemove(id: string, libelle: string) {
    if (!confirm(`Supprimer l'intervention « ${libelle} » ?`)) return
    const r = await removePoeiInterventionAction(id, poeiId)
    if (r.success) { toast('success', 'Intervention supprimée'); router.refresh() }
    else toast('error', r.error || 'Erreur')
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-sky-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Formateurs & interventions ({interventions.length})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {dureeTotale != null && (
            <span className={cn(
              'text-xs font-medium px-2 py-1 rounded-lg',
              reste === 0 ? 'bg-emerald-50 text-emerald-700'
                : reste! < 0 ? 'bg-rose-50 text-rose-700'
                : 'bg-amber-50 text-amber-700',
            )}>
              {heuresAffectees}h / {dureeTotale}h affectées
              {reste! > 0 && ` · ${reste}h à couvrir`}
              {reste! < 0 && ` · ${Math.abs(reste!)}h en trop`}
            </span>
          )}
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700">
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {interventions.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-surface-400">
          Aucune intervention. Découpez le parcours en périodes et affectez un formateur à chacune
          (ex. « Semaine 1 — Hygiène », « Semaines 2 à 4 — Pratique »).
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {interventions.map((iv) => {
            const meta = MISSION_META[iv.mission_status] || MISSION_META.not_required
            const { Icon } = meta
            // La jointure remonte un tableau (un contrat par intervention)
            const contrat = Array.isArray(iv.contrat) ? iv.contrat[0] : iv.contrat
            const signe = Boolean(contrat?.signature_formateur_date)
            return (
              <div key={iv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-medium text-surface-900">{iv.libelle}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-surface-500 mt-0.5">
                    <span>{iv.formateur ? `${iv.formateur.prenom || ''} ${iv.formateur.nom || ''}`.trim() : 'Formateur non affecté'}</span>
                    {iv.date_debut && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(iv.date_debut, { day: 'numeric', month: 'short' })}
                        {iv.date_fin && iv.date_fin !== iv.date_debut ? ` → ${formatDate(iv.date_fin, { day: 'numeric', month: 'short' })}` : ''}
                      </span>
                    )}
                    {iv.nb_heures ? <span>{iv.nb_heures} h</span> : null}
                    {iv.montant_ht ? <span>{Number(iv.montant_ht).toLocaleString('fr-FR')} €</span> : null}
                  </div>
                  {iv.mission_status === 'refused' && iv.mission_response_comment && (
                    <div className="text-xs text-rose-600 mt-1">Motif : {iv.mission_response_comment}</div>
                  )}
                </div>

                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0', meta.cls)}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>

                {contrat && (
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0',
                    signe ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700',
                  )}>
                    <CheckCircle2 className="h-3 w-3" /> Contrat {signe ? 'signé' : 'envoyé'}
                  </span>
                )}

                <div className="shrink-0">
                  <RowMenu items={[
                    ...(contrat && iv.formateur_id ? [{
                      label: signe ? 'Télécharger le contrat signé' : 'Voir le contrat',
                      icon: <Download className="h-4 w-4 text-surface-400" />,
                      onClick: () => window.open(`/api/pdf/contrat-formateur/${iv.formateur_id}?contrat=${contrat.id}`, '_blank'),
                    }] : []),
                    { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditIv(iv) },
                    { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleRemove(iv.id, iv.libelle) },
                  ]} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Ajouter une intervention" size="md">
        <InterventionForm poeiId={poeiId} formateurs={formateurs} onDone={() => { setAddOpen(false); router.refresh() }} />
      </Modal>
      <Modal isOpen={!!editIv} onClose={() => setEditIv(null)} title="Modifier l'intervention" size="md">
        {editIv && <InterventionForm poeiId={poeiId} intervention={editIv} formateurs={formateurs} onDone={() => { setEditIv(null); router.refresh() }} />}
      </Modal>
    </div>
  )
}
