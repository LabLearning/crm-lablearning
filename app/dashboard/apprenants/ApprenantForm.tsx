'use client'

import { useState } from 'react'
import { Save, Accessibility } from 'lucide-react'
import { Button, Input, Select, useToast } from '@/components/ui'
import { createApprenantAction, updateApprenantAction } from './actions'
import type { Apprenant } from '@/lib/types/formation'
import type { Client } from '@/lib/types/crm'

/**
 * Formulaire complet d'un apprenant (état civil, contrat, handicap…), partagé
 * entre la fiche Apprenants et la gestion des participants d'une session.
 * `onDone` reçoit l'apprenant créé/réutilisé (data de l'action) pour permettre
 * à l'appelant de l'inscrire directement à une session.
 */
export function ApprenantForm({
  apprenant, clients, defaultClientId, onDone,
}: {
  apprenant?: Apprenant
  clients: Pick<Client, 'id' | 'raison_sociale'>[]
  defaultClientId?: string
  onDone: (created?: any) => void
}) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [showHandicap, setShowHandicap] = useState(apprenant?.situation_handicap || false)

  const clientOptions = [
    { value: '', label: 'Aucune entreprise' },
    ...clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id })),
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    if (!showHandicap) {
      fd.set('situation_handicap', 'false')
      fd.delete('type_handicap')
      fd.delete('besoins_adaptation')
    }
    const result = apprenant ? await updateApprenantAction(apprenant.id, fd) : await createApprenantAction(fd)
    if (result.success) {
      toast('success', apprenant ? 'Apprenant mis à jour' : 'Apprenant créé')
      onDone((result as any).data)
    }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <Select id="client_id" name="client_id" label="Entreprise rattachée" options={clientOptions} defaultValue={apprenant?.client_id || defaultClientId || ''} />
      <div className="grid grid-cols-3 gap-3">
        <Select id="civilite" name="civilite" label="Civilité" options={[{ value: '', label: '—' }, { value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]} defaultValue={apprenant?.civilite || ''} />
        <Input id="prenom" name="prenom" label="Prénom *" defaultValue={apprenant?.prenom || ''} error={errors.prenom?.[0]} />
        <Input id="nom" name="nom" label="Nom *" defaultValue={apprenant?.nom || ''} error={errors.nom?.[0]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="email" name="email" type="email" label="Email" defaultValue={apprenant?.email || ''} error={errors.email?.[0]} />
        <Input id="telephone" name="telephone" label="Téléphone" defaultValue={apprenant?.telephone || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Input id="whatsapp" name="whatsapp" label="WhatsApp" placeholder="06 12 34 56 78" defaultValue={(apprenant as any)?.whatsapp || ''} />
        <label className="flex items-center gap-2 text-sm text-surface-700 pb-2.5 cursor-pointer">
          <input type="checkbox" name="whatsapp_opt_in" value="true" defaultChecked={(apprenant as any)?.whatsapp_opt_in || false}
            className="h-4 w-4 rounded border-surface-300 text-emerald-600 focus:ring-emerald-500" />
          Accepte les rappels WhatsApp
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select id="sexe" name="sexe" label="Sexe" options={[{ value: '', label: '—' }, { value: 'H', label: 'Homme' }, { value: 'F', label: 'Femme' }]} defaultValue={(apprenant as any)?.sexe || ''} />
        <Input id="date_naissance" name="date_naissance" type="date" label="Date de naissance" defaultValue={apprenant?.date_naissance || ''} />
        <Input id="poste" name="poste" label="Poste" defaultValue={apprenant?.poste || ''} />
      </div>

      {/* État civil — repris du participant, exigé dans les dossiers de financement */}
      <div className="grid grid-cols-2 gap-3">
        <Input id="lieu_naissance" name="lieu_naissance" label="Lieu de naissance" defaultValue={(apprenant as any)?.lieu_naissance || ''} />
        <Input id="numero_securite_sociale" name="numero_securite_sociale" label="N° de sécurité sociale" defaultValue={(apprenant as any)?.numero_securite_sociale || ''} />
      </div>
      <Input id="adresse" name="adresse" label="Adresse" defaultValue={(apprenant as any)?.adresse || ''} />
      <div className="grid grid-cols-3 gap-3">
        <Input id="code_postal" name="code_postal" label="Code postal" defaultValue={(apprenant as any)?.code_postal || ''} />
        <Input id="ville" name="ville" label="Ville" defaultValue={(apprenant as any)?.ville || ''} />
        <Input id="type_contrat" name="type_contrat" label="Type de contrat" defaultValue={(apprenant as any)?.type_contrat || ''} placeholder="CDI, CDD, Alternance…" />
      </div>
      <Input id="entreprise" name="entreprise" label="Entreprise (si différente)" defaultValue={apprenant?.entreprise || ''} />

      {/* Handicap section (Qualiopi C6, Indicateur 26) */}
      <div className="pt-2 border-t border-surface-100">
        <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
          <input
            type="checkbox"
            name="situation_handicap"
            value="true"
            checked={showHandicap}
            onChange={(e) => setShowHandicap(e.target.checked)}
            className="rounded border-surface-300"
          />
          <Accessibility className="h-4 w-4 text-surface-500" />
          Situation de handicap (Qualiopi C6)
        </label>

        {showHandicap && (
          <div className="mt-3 ml-6 space-y-3 p-3 rounded-xl bg-surface-50 border border-surface-200/60">
            <Input id="type_handicap" name="type_handicap" label="Type de handicap" defaultValue={apprenant?.type_handicap || ''} placeholder="Visuel, auditif, moteur, cognitif..." />
            <textarea id="besoins_adaptation" name="besoins_adaptation" rows={3} className="input-base resize-none" placeholder="Besoins d'adaptation : supports en grands caractères, interprète LSF, accès PMR..." defaultValue={apprenant?.besoins_adaptation || ''} />
            <p className="text-2xs text-surface-400">Ces informations sont confidentielles et utilisées uniquement pour adapter la formation (RGPD).</p>
          </div>
        )}
      </div>

      <textarea id="notes" name="notes" rows={2} className="input-base resize-none" placeholder="Notes internes..." defaultValue={apprenant?.notes || ''} />

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={() => onDone()}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {apprenant ? 'Mettre à jour' : 'Créer l\'apprenant'}
        </Button>
      </div>
    </form>
  )
}
