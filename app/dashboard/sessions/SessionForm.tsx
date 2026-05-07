'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button, Input, Select, FormateurDispoBadge } from '@/components/ui'
import { createSessionAction, updateSessionAction } from './actions'
import { SESSION_STATUS_LABELS } from '@/lib/types/formation'
import type { Session, Formation, Formateur } from '@/lib/types/formation'

interface SessionFormProps {
  session?: Session
  formations: Pick<Formation, 'id' | 'intitule' | 'reference' | 'modalite' | 'duree_heures'>[]
  formateurs: Pick<Formateur, 'id' | 'prenom' | 'nom'>[]
  onSuccess: () => void
  onCancel: () => void
}

const statusOptions = Object.entries(SESSION_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function SessionForm({ session, formations, formateurs, onSuccess, onCancel }: SessionFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)

  // Controlled : pour pouvoir vérifier la dispo en temps réel
  const [formateurId, setFormateurId] = useState(session?.formateur_id || '')
  const [dateDebut, setDateDebut] = useState(session?.date_debut || '')
  const [dateFin, setDateFin] = useState(session?.date_fin || '')

  const formationOptions = formations.map((f) => ({
    value: f.id,
    label: `${f.reference ? f.reference + ' — ' : ''}${f.intitule}`,
  }))

  const formateurOptions = [
    { value: '', label: 'Non assigné' },
    ...formateurs.map((f) => ({ value: f.id, label: `${f.prenom} ${f.nom}` })),
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true); setErrors({}); setError(null)
    const fd = new FormData(e.currentTarget)
    const result = session ? await updateSessionAction(session.id, fd) : await createSessionAction(fd)
    if (result.success) onSuccess()
    else if (result.errors) setErrors(result.errors)
    if (result.error) setError(result.error)
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {error && <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">{error}</div>}

      <Select id="formation_id" name="formation_id" label="Formation *" options={formationOptions} defaultValue={session?.formation_id || ''} placeholder="Sélectionner une formation" error={errors.formation_id?.[0]} />

      <div className="grid grid-cols-2 gap-3">
        <Input id="reference" name="reference" label="Référence session" placeholder="SES-2024-001" defaultValue={session?.reference || ''} />
        {session && <Select id="status" name="status" label="Statut" options={statusOptions} defaultValue={session.status} />}
      </div>

      <Input id="intitule" name="intitule" label="Intitulé personnalisé" placeholder="Optionnel — surcharge le nom de la formation" defaultValue={session?.intitule || ''} />

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Planning</div>

      <div className="grid grid-cols-2 gap-3">
        <Input id="date_debut" name="date_debut" type="date" label="Date de début *" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} error={errors.date_debut?.[0]} />
        <Input id="date_fin" name="date_fin" type="date" label="Date de fin *" value={dateFin} onChange={(e) => setDateFin(e.target.value)} error={errors.date_fin?.[0]} />
      </div>

      <Input id="horaires" name="horaires" label="Horaires" placeholder="09:00 - 12:30 / 14:00 - 17:30" defaultValue={session?.horaires || ''} />

      <Select
        id="formateur_id" name="formateur_id" label="Formateur"
        options={formateurOptions}
        value={formateurId}
        onChange={(e) => setFormateurId(e.target.value)}
      />

      {/* Badge de disponibilité — temps réel quand formateur + dates sont remplis */}
      {formateurId && dateDebut && dateFin && (
        <FormateurDispoBadge
          formateurId={formateurId}
          dateDebut={dateDebut}
          dateFin={dateFin}
          excludeSessionId={session?.id}
        />
      )}

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Lieu</div>

      <Input id="lieu" name="lieu" label="Lieu / Salle" placeholder="Salle A / Distanciel" defaultValue={session?.lieu || ''} />
      <div className="grid grid-cols-3 gap-3">
        <Input id="adresse" name="adresse" label="Adresse" defaultValue={session?.adresse || ''} />
        <Input id="code_postal" name="code_postal" label="CP" defaultValue={session?.code_postal || ''} />
        <Input id="ville" name="ville" label="Ville" defaultValue={session?.ville || ''} />
      </div>
      <Input id="lien_visio" name="lien_visio" label="Lien visioconférence" placeholder="https://zoom.us/j/..." defaultValue={session?.lien_visio || ''} error={errors.lien_visio?.[0]} />

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Capacité</div>

      <div className="grid grid-cols-2 gap-3">
        <Input id="places_min" name="places_min" type="number" label="Places minimum" defaultValue={session?.places_min?.toString() || '1'} />
        <Input id="places_max" name="places_max" type="number" label="Places maximum" defaultValue={session?.places_max?.toString() || '12'} />
      </div>

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Coûts</div>
      <div className="grid grid-cols-3 gap-3">
        <Input id="cout_formateur" name="cout_formateur" type="number" label="Coût formateur (€)" defaultValue={session?.cout_formateur?.toString() || ''} />
        <Input id="cout_salle" name="cout_salle" type="number" label="Coût salle (€)" defaultValue={session?.cout_salle?.toString() || ''} />
        <Input id="cout_materiel" name="cout_materiel" type="number" label="Coût matériel (€)" defaultValue={session?.cout_materiel?.toString() || ''} />
      </div>

      <textarea id="notes_internes" name="notes_internes" rows={2} className="input-base resize-none" placeholder="Notes internes..." defaultValue={session?.notes_internes || ''} />

      <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>
          {session ? 'Mettre à jour' : 'Créer la session'}
        </Button>
      </div>
    </form>
  )
}
