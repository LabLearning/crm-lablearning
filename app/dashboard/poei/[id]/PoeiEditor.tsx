'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { Button, Input, Select, useToast } from '@/components/ui'
import { updatePoeiAction } from '../actions'
import type { Poei } from '@/lib/types/poei'

interface Props {
  poei: Poei
  clients: { id: string; raison_sociale: string | null }[]
  formations: { id: string; intitule: string }[]
}

export function PoeiEditor({ poei, clients, formations }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))
  const formationOptions = formations.map((f) => ({ value: f.id, label: f.intitule }))
  const d = (v: string | null) => v || ''

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const result = await updatePoeiAction(poei.id, fd)
    setSaving(false)
    if (result.success) { toast('success', 'Projet mis à jour'); router.refresh() }
    else toast('error', result.error || 'Erreur')
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="card p-5">
        <div className="section-label mb-3">Projet</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select id="client_id" name="client_id" label="Entreprise" defaultValue={d(poei.client_id)} options={clientOptions} />
          <Select id="formation_id" name="formation_id" label="Programme" defaultValue={d(poei.formation_id)} options={formationOptions} />
          <Input id="date_debut" name="date_debut" type="date" label="Début" defaultValue={d(poei.date_debut)} />
          <Input id="date_fin" name="date_fin" type="date" label="Fin" defaultValue={d(poei.date_fin)} />
          <Input id="duree_heures" name="duree_heures" type="number" label="Durée (h) — max 400" defaultValue={poei.duree_heures != null ? String(poei.duree_heures) : ''} />
        </div>
      </div>

      <div className="card p-5">
        <div className="section-label mb-3">Financement France Travail</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input id="montant_horaire" name="montant_horaire" type="number" label="Taux horaire (€)" defaultValue={poei.montant_horaire != null ? String(poei.montant_horaire) : ''} />
          <Input id="numero_dossier_ft" name="numero_dossier_ft" label="N° dossier France Travail" defaultValue={d(poei.numero_dossier_ft)} />
          <div className="flex items-end text-sm text-surface-500">
            {poei.montant_total != null ? `Total : ${Number(poei.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : 'Total = durée × taux'}
          </div>
        </div>
      </div>

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
