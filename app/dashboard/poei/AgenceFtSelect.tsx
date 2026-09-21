'use client'

import { useState } from 'react'
import { Plus, Landmark } from '@/components/ui/icons'
import { Select, Input, Button, Modal, useToast } from '@/components/ui'
import { createAgenceFtAction } from './actions'

export interface AgenceFt { id: string; nom: string; ville?: string | null }

interface Props {
  /** Nom du champ dans le formulaire parent (FormData). */
  name?: string
  id?: string
  label?: string
  agences: AgenceFt[]
  value?: string | null
  defaultValue?: string | null
  /** Appelé après création ou changement ; l'agence créée est déjà sélectionnée. */
  onChange?: (agenceId: string, agence?: AgenceFt) => void
  disabled?: boolean
}

/**
 * Choix de l'agence France Travail facturée, avec création à la volée : la
 * facture POEI est adressée à l'agence, pas à l'entreprise, il faut donc
 * pouvoir déclarer une nouvelle direction régionale sans quitter le dossier.
 */
export function AgenceFtSelect({ name = 'agence_ft_id', id = 'agence_ft_id', label = 'Agence France Travail facturée', agences, value, defaultValue, onChange, disabled }: Props) {
  const { toast } = useToast()
  const [liste, setListe] = useState<AgenceFt[]>(agences)
  const [choix, setChoix] = useState<string>(value ?? defaultValue ?? '')
  const [ouvert, setOuvert] = useState(false)
  const [creation, setCreation] = useState(false)
  const courant = value !== undefined && value !== null ? value : choix

  async function creer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    setCreation(true)
    const r = await createAgenceFtAction(new FormData(e.currentTarget))
    setCreation(false)
    if (!r.success || !r.data) { toast('error', r.error || 'Erreur'); return }
    const a: AgenceFt = { id: (r.data as any).id, nom: (r.data as any).nom, ville: (r.data as any).ville }
    setListe((l) => [...l, a].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')))
    setChoix(a.id)
    onChange?.(a.id, a)
    setOuvert(false)
    toast('success', `Agence ${a.nom} créée et sélectionnée`)
  }

  return (
    <div>
      <Select
        id={id} name={name} label={label} value={courant} disabled={disabled}
        onChange={(e) => { setChoix(e.target.value); onChange?.(e.target.value, liste.find((a) => a.id === e.target.value)) }}
        options={[{ value: '', label: 'À préciser' }, ...liste.map((a) => ({ value: a.id, label: a.ville ? `${a.nom} (${a.ville})` : a.nom }))]}
      />
      {!disabled && (
        <button type="button" onClick={() => setOuvert(true)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline min-h-[28px]">
          <Plus className="h-3.5 w-3.5" /> Nouvelle agence
        </button>
      )}

      <Modal isOpen={ouvert} onClose={() => setOuvert(false)} size="md" title="Nouvelle agence France Travail"
        description="Le destinataire des factures POEI : direction régionale ou agence, avec l'adresse et le SIRET tels qu'ils doivent figurer sur la facture.">
        <form onSubmit={creer} className="space-y-3">
          <Input id="agence_nom" name="nom" label="Nom" placeholder="FRANCE TRAVAIL DR NOUVELLE-AQUITAINE" required />
          <Input id="agence_adresse" name="adresse" label="Adresse" placeholder="Rue, bâtiment, service" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input id="agence_cp" name="code_postal" label="Code postal" />
            <div className="sm:col-span-2"><Input id="agence_ville" name="ville" label="Ville" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="agence_siret" name="siret" label="SIRET" placeholder="14 chiffres" />
            <Input id="agence_tva" name="tva_intra" label="TVA intracommunautaire" placeholder="FR…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="agence_email" name="email" type="email" label="Email de facturation" />
            <Input id="agence_tel" name="telephone" label="Téléphone" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button type="submit" isLoading={creation} icon={<Landmark className="h-4 w-4" />}>Créer l&apos;agence</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
