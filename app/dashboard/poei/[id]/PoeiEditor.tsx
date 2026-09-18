'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from '@/components/ui/icons'
import { Button, Input, Select, useToast } from '@/components/ui'
import { updatePoeiAction } from '../actions'
import { companyLabel } from '@/lib/utils'
import type { Poei } from '@/lib/types/poei'

interface Props {
  poei: Poei
  clients: { id: string; raison_sociale: string | null; nom_commercial?: string | null; sigle?: string | null }[]
  formations: { id: string; intitule: string }[]
  nbCandidats?: number
  /** Chiffres réels du dossier, issus des factures. */
  finances: { total: number; encaisse: number; nbFactures: number }
  agences?: { id: string; nom: string; ville?: string | null }[]
}

export function PoeiEditor({ poei, clients, formations, nbCandidats = 0, finances, agences = [], referent = null }: Props & { referent?: { prenom?: string | null; nom?: string | null; email?: string | null; telephone?: string | null } | null }) {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const clientOptions = clients.map((c) => ({ value: c.id, label: companyLabel(c) || c.id }))
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
      <div className="card p-4 sm:p-5">
        <div className="section-label mb-3">Projet</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select id="client_id" name="client_id" label="Entreprise" defaultValue={d(poei.client_id)} options={clientOptions} />
          <Select id="formation_id" name="formation_id" label="Programme" defaultValue={d(poei.formation_id)} options={formationOptions} />
          <Input id="date_debut" name="date_debut" type="date" label="Début" defaultValue={d(poei.date_debut)} />
          <Input id="date_fin" name="date_fin" type="date" label="Fin" defaultValue={d(poei.date_fin)} />
          <Input id="duree_heures" name="duree_heures" type="number" label="Durée (h), 400 au plus" defaultValue={poei.duree_heures != null ? String(poei.duree_heures) : ''} />
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="section-label mb-3">Financement France Travail</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Destinataire des factures du dossier. */}
          <Select
            id="agence_ft_id"
            name="agence_ft_id"
            label="Agence France Travail facturée"
            defaultValue={(poei as any).agence_ft_id || ''}
            options={[{ value: '', label: 'À préciser' }, ...agences.map((a) => ({ value: a.id, label: a.ville ? `${a.nom} (${a.ville})` : a.nom }))]}
          />
          <Input id="montant_horaire" name="montant_horaire" type="number" label="Taux horaire (€)" defaultValue={poei.montant_horaire != null ? String(poei.montant_horaire) : ''} />
          {/* Le montant et l'encaissement viennent des FACTURES du dossier :
              les saisir ici créait une seconde vérité qui divergeait. */}
          <div className="sm:col-span-2 flex items-end pb-1 text-sm text-surface-600">
            {finances.nbFactures > 0 ? (
              <span>
                <span className="font-medium text-surface-800">{finances.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                {' '}facturés sur {finances.nbFactures} facture{finances.nbFactures > 1 ? 's' : ''} ·{' '}
                {finances.encaisse > 0
                  ? <span className="text-success-600 font-medium">{finances.encaisse.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € encaissés</span>
                  : <span className="text-warning-600 font-medium">aucun encaissement</span>}
              </span>
            ) : (
              <span className="text-surface-400">
                Montant calculé à la facturation : taux × durée × nombre de candidats ({nbCandidats} actuellement)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input id="date_depot_ft" name="date_depot_ft" type="date" label="Demandé le" defaultValue={d(poei.date_depot_ft)} />
          <Input id="date_accord_ft" name="date_accord_ft" type="date" label="Accordé le" defaultValue={d(poei.date_accord_ft)} />
          <Input id="date_mise_en_paiement" name="date_mise_en_paiement" type="date" label="Mise en paiement le" defaultValue={d((poei as any).date_mise_en_paiement)} />
          <Input id="date_paiement" name="date_paiement" type="date" label="Paiement reçu le" defaultValue={d((poei as any).date_paiement)} />
        </div>

      </div>

      <div className="card p-4 sm:p-5">
        {/*
          Le représentant de l'employeur est le contact référent de
          l'entreprise : une seule source, la fiche client, pas de copie qui
          divergerait. C'est lui qui signe l'attestation de développement de
          compétences et reçoit le lien de signature.
        */}
        <div className="section-label mb-3">Employeur, représentant</div>
        <div className="rounded-xl border border-surface-200 px-4 py-3 mb-5 text-sm">
          {referent ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="font-medium text-surface-900">{[referent.prenom, referent.nom].filter(Boolean).join(' ')}</span>
              {referent.email && <span className="text-surface-600">{referent.email}</span>}
              {referent.telephone && <span className="text-surface-600">{referent.telephone}</span>}
              <span className="text-xs text-surface-400 w-full sm:w-auto">Contact référent de l'entreprise, modifiable sur la fiche client</span>
            </div>
          ) : (
            <span className="text-surface-500">
              Aucun contact référent sur l'entreprise : ajoutez-en un sur la fiche client pour la signature de l'attestation.
            </span>
          )}
        </div>

        <div className="section-label mb-3">Notes internes</div>
        <textarea id="notes" name="notes" rows={3} className="input-base resize-none w-full" defaultValue={d(poei.notes)} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" isLoading={saving} icon={<Save className="h-4 w-4" />} className="w-full sm:w-auto">Enregistrer</Button>
      </div>
    </form>
  )
}
