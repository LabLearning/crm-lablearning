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

  // Pas de <form> dans la modale : le sélecteur vit souvent dans un formulaire
  // parent (création du projet, paramètres), et un formulaire imbriqué est
  // ignoré par le navigateur : le clic partait dans le formulaire parent.
  const [champs, setChamps] = useState({ nom: '', adresse: '', code_postal: '', ville: '', siret: '', tva_intra: '', email: '', telephone: '' })
  const maj = (k: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement>) => setChamps({ ...champs, [k]: e.target.value })

  async function creer() {
    if (!champs.nom.trim()) { toast('error', 'Le nom de l\u2019agence est requis'); return }
    setCreation(true)
    const fd = new FormData()
    for (const [k, v] of Object.entries(champs)) fd.set(k, v.trim())
    const r = await createAgenceFtAction(fd)
    setCreation(false)
    if (!r.success || !r.data) { toast('error', r.error || 'Erreur'); return }
    const a: AgenceFt = { id: (r.data as any).id, nom: (r.data as any).nom, ville: (r.data as any).ville }
    setListe((l) => [...l, a].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')))
    setChoix(a.id)
    onChange?.(a.id, a)
    setOuvert(false)
    setChamps({ nom: '', adresse: '', code_postal: '', ville: '', siret: '', tva_intra: '', email: '', telephone: '' })
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
        <div className="space-y-3">
          <Input id="agence_nom" label="Nom" placeholder="FRANCE TRAVAIL DR NOUVELLE-AQUITAINE" required value={champs.nom} onChange={maj('nom')} />
          <Input id="agence_adresse" label="Adresse" placeholder="Rue, bâtiment, service" value={champs.adresse} onChange={maj('adresse')} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input id="agence_cp" label="Code postal" value={champs.code_postal} onChange={maj('code_postal')} />
            <div className="sm:col-span-2"><Input id="agence_ville" label="Ville" value={champs.ville} onChange={maj('ville')} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="agence_siret" label="SIRET" placeholder="14 chiffres" value={champs.siret} onChange={maj('siret')} />
            <Input id="agence_tva" label="TVA intracommunautaire" placeholder="FR…" value={champs.tva_intra} onChange={maj('tva_intra')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="agence_email" type="email" label="Email de facturation" value={champs.email} onChange={maj('email')} />
            <Input id="agence_tel" label="Téléphone" value={champs.telephone} onChange={maj('telephone')} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button type="button" onClick={creer} isLoading={creation} icon={<Landmark className="h-4 w-4" />}>Créer l&apos;agence</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
