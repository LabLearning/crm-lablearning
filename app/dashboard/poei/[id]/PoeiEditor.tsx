'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { Button, Input, Select, useToast } from '@/components/ui'
import { updatePoeiAction } from '../actions'
import { TYPE_CONTRAT_LABELS } from '@/lib/types/poei'
import type { Poei } from '@/lib/types/poei'

interface Props {
  poei: Poei
  clients: { id: string; raison_sociale: string | null }[]
  formations: { id: string; intitule: string }[]
  sessions: any[]
}

const contratOptions = [{ value: '', label: '—' }, ...Object.entries(TYPE_CONTRAT_LABELS).map(([v, l]) => ({ value: v, label: l as string }))]

export function PoeiEditor({ poei, clients, formations, sessions }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const clientOptions = [{ value: '', label: 'Aucun' }, ...clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))]
  const formationOptions = [{ value: '', label: 'Aucune' }, ...formations.map((f) => ({ value: f.id, label: f.intitule }))]
  const sessionOptions = [{ value: '', label: 'Aucune' }, ...sessions.map((s) => {
    const d = s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
    return { value: s.id, label: [s.intitule || s.reference || 'Session', d ? `(${d})` : ''].filter(Boolean).join(' ') }
  })]

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const result = await updatePoeiAction(poei.id, fd)
    setSaving(false)
    if (result.success) { toast('success', 'POEI mise à jour'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  const d = (v: string | null) => v || ''

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Candidat */}
      <div className="card p-5">
        <div className="section-label mb-3">Candidat (demandeur d'emploi)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select id="candidat_civilite" name="candidat_civilite" label="Civilité" defaultValue={d(poei.candidat_civilite)} options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} />
          <Input id="candidat_prenom" name="candidat_prenom" label="Prénom" defaultValue={d(poei.candidat_prenom)} />
          <Input id="candidat_nom" name="candidat_nom" label="Nom" defaultValue={d(poei.candidat_nom)} className="sm:col-span-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Input id="candidat_email" name="candidat_email" type="email" label="Email" defaultValue={d(poei.candidat_email)} />
          <Input id="candidat_telephone" name="candidat_telephone" label="Téléphone" defaultValue={d(poei.candidat_telephone)} />
          <Input id="candidat_identifiant_ft" name="candidat_identifiant_ft" label="Identifiant France Travail" defaultValue={d(poei.candidat_identifiant_ft)} />
        </div>
      </div>

      {/* Employeur */}
      <div className="card p-5">
        <div className="section-label mb-3">Employeur & poste</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select id="client_id" name="client_id" label="Employeur" defaultValue={d(poei.client_id)} options={clientOptions} />
          <Input id="poste_vise" name="poste_vise" label="Poste visé" defaultValue={d(poei.poste_vise)} />
          <Select id="type_contrat" name="type_contrat" label="Type de contrat" defaultValue={d(poei.type_contrat)} options={contratOptions} />
          <Input id="date_embauche_prevue" name="date_embauche_prevue" type="date" label="Date d'embauche prévue" defaultValue={d(poei.date_embauche_prevue)} />
          <Input id="tuteur_nom" name="tuteur_nom" label="Tuteur" defaultValue={d(poei.tuteur_nom)} className="sm:col-span-2" />
        </div>
      </div>

      {/* Formation */}
      <div className="card p-5">
        <div className="section-label mb-3">Formation</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select id="formation_id" name="formation_id" label="Formation" defaultValue={d(poei.formation_id)} options={formationOptions} />
          <Select id="session_id" name="session_id" label="Session" defaultValue={d(poei.session_id)} options={sessionOptions} />
          <Input id="duree_heures" name="duree_heures" type="number" label="Durée (h) — max 400" defaultValue={poei.duree_heures != null ? String(poei.duree_heures) : ''} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="date_debut" name="date_debut" type="date" label="Début" defaultValue={d(poei.date_debut)} />
            <Input id="date_fin" name="date_fin" type="date" label="Fin" defaultValue={d(poei.date_fin)} />
          </div>
        </div>
      </div>

      {/* France Travail */}
      <div className="card p-5">
        <div className="section-label mb-3">Financement France Travail</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input id="montant_horaire" name="montant_horaire" type="number" label="Taux horaire (€)" defaultValue={poei.montant_horaire != null ? String(poei.montant_horaire) : ''} />
          <Input id="numero_dossier_ft" name="numero_dossier_ft" label="N° dossier France Travail" defaultValue={d(poei.numero_dossier_ft)} />
          <div className="flex items-end text-sm text-surface-500">
            {poei.montant_total != null ? `Total : ${Number(poei.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : 'Total calculé : durée × taux'}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <div className="section-label mb-3">Notes internes</div>
        <textarea id="notes" name="notes" rows={3} className="input-base resize-none w-full" defaultValue={d(poei.notes)} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" isLoading={saving} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
      </div>
    </form>
  )
}
