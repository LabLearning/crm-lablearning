'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, CheckCircle2 } from 'lucide-react'
import { Button, Input, Select, useToast } from '@/components/ui'
import { updatePoeiAction } from '../actions'
import type { Poei } from '@/lib/types/poei'

interface Props {
  poei: Poei
  clients: { id: string; raison_sociale: string | null }[]
  formations: { id: string; intitule: string }[]
  nbCandidats?: number
}

export function PoeiEditor({ poei, clients, formations, nbCandidats = 0 }: Props) {
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

        {/* Tracker : Demandé → Accordé → Mise en paiement → Paiement reçu */}
        <div className="flex items-center gap-0 mb-4 overflow-x-auto">
          {[
            { label: 'Demandé', date: poei.date_depot_ft },
            { label: 'Accordé', date: poei.date_accord_ft },
            { label: 'Mise en paiement', date: (poei as any).date_mise_en_paiement },
            { label: 'Paiement reçu', date: (poei as any).date_paiement },
          ].map((step, i, arr) => {
            const done = !!step.date
            return (
              <div key={step.label} className="flex items-center shrink-0">
                <div className="flex flex-col items-center px-1.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'bg-surface-100 text-surface-400'}`}>
                    {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <div className={`text-[10px] mt-1 font-medium whitespace-nowrap ${done ? 'text-emerald-700' : 'text-surface-400'}`}>{step.label}</div>
                  <div className="text-[9px] text-surface-400 h-3">{step.date ? new Date(step.date).toLocaleDateString('fr-FR') : ''}</div>
                </div>
                {i < arr.length - 1 && <div className={`h-0.5 w-8 sm:w-14 mb-6 ${done ? 'bg-emerald-300' : 'bg-surface-200'}`} />}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Input id="montant_horaire" name="montant_horaire" type="number" label="Taux horaire (€)" defaultValue={poei.montant_horaire != null ? String(poei.montant_horaire) : ''} />
          <div className="flex items-end text-sm text-surface-500 pb-2.5">
            {poei.montant_total != null
              ? `Total : ${Number(poei.montant_total).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € (${poei.montant_horaire ?? "?"} € × ${poei.duree_heures ?? "?"} h × ${nbCandidats} candidat${nbCandidats > 1 ? "s" : ""})`
              : `Total = taux × durée × nb candidats (${nbCandidats} candidat${nbCandidats > 1 ? "s" : ""} actuellement)`}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input id="date_depot_ft" name="date_depot_ft" type="date" label="Demandé le" defaultValue={d(poei.date_depot_ft)} />
          <Input id="date_accord_ft" name="date_accord_ft" type="date" label="Accordé le" defaultValue={d(poei.date_accord_ft)} />
          <Input id="date_mise_en_paiement" name="date_mise_en_paiement" type="date" label="Mise en paiement le" defaultValue={d((poei as any).date_mise_en_paiement)} />
          <Input id="date_paiement" name="date_paiement" type="date" label="Paiement reçu le" defaultValue={d((poei as any).date_paiement)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 items-end">
          <Input id="montant_paye" name="montant_paye" type="number" label="Montant encaissé (€)" defaultValue={(poei as any).montant_paye != null ? String((poei as any).montant_paye) : ''} />
          {poei.montant_total != null && (
            <div className="text-sm pb-2.5">
              {(() => {
                const paye = Number((poei as any).montant_paye) || 0
                const reste = Math.max(0, Number(poei.montant_total) - paye)
                return reste > 0
                  ? <span className="text-warning-600 font-medium">{`Reste à percevoir : ${reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`}</span>
                  : <span className="text-emerald-600 font-medium">Totalité encaissée</span>
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="section-label mb-3">Notes internes</div>
        <textarea id="notes" name="notes" rows={3} className="input-base resize-none w-full" defaultValue={d(poei.notes)} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" isLoading={saving} icon={<Save className="h-4 w-4" />} className="!bg-sky-500 hover:!bg-sky-600">Enregistrer</Button>
      </div>
    </form>
  )
}
