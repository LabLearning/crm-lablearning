'use client'

import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Euro, Percent,
  CheckCircle2, XCircle, Save, Handshake, Download,
} from 'lucide-react'
import { Button, Badge, Input, Select, Modal, useToast, CompanySearchInput, RowMenu } from '@/components/ui'
import { createApporteurAction, updateApporteurAction, deleteApporteurAction, toggleApporteurAction } from './actions'
import type { ApporteurAffaires } from '@/lib/types/crm'
import type { SireneCompany } from '@/lib/sirene'

interface ApporteursListProps {
  apporteurs: ApporteurAffaires[]
}

function ApporteurForm({ apporteur, onDone }: { apporteur?: ApporteurAffaires; onDone: () => void }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [modeCalc, setModeCalc] = useState(apporteur?.mode_calcul || 'pourcentage')
  const [raisonSociale, setRaisonSociale] = useState(apporteur?.raison_sociale || '')

  function handleCompanySelect(c: SireneCompany) {
    setRaisonSociale(c.raison_sociale)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.set('mode_calcul', modeCalc)
    const result = apporteur
      ? await updateApporteurAction(apporteur.id, fd)
      : await createApporteurAction(fd)
    if (result.success) { toast('success', apporteur ? 'Mis à jour' : 'Apporteur créé'); onDone() }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select id="type" name="type" label="Type" options={[{ value: 'entreprise', label: 'Entreprise' }, { value: 'particulier', label: 'Particulier' }]} defaultValue={apporteur?.type || 'entreprise'} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="nom" name="nom" label="Nom *" defaultValue={apporteur?.nom || ''} error={errors.nom?.[0]} />
        <Input id="prenom" name="prenom" label="Prénom" defaultValue={apporteur?.prenom || ''} />
      </div>
      <CompanySearchInput
        id="raison_sociale"
        name="raison_sociale"
        label="Raison sociale"
        defaultValue={raisonSociale}
        onSelect={handleCompanySelect}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input id="email" name="email" type="email" label="Email" defaultValue={apporteur?.email || ''} error={errors.email?.[0]} />
        <Input id="telephone" name="telephone" label="Téléphone" defaultValue={apporteur?.telephone || ''} />
      </div>

      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Commission</div>
      <div className="flex gap-2 mb-3">
        {['pourcentage', 'fixe'].map((m) => (
          <button key={m} type="button" onClick={() => setModeCalc(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${modeCalc === m ? 'bg-surface-900 text-white shadow-xs' : 'bg-surface-100 text-surface-600'}`}
          >
            {m === 'pourcentage' ? 'Pourcentage (%)' : 'Montant fixe (€)'}
          </button>
        ))}
      </div>
      {modeCalc === 'pourcentage' ? (
        <Input id="taux_commission" name="taux_commission" type="number" label="Taux de commission (%)" defaultValue={apporteur?.taux_commission?.toString() || '10'} />
      ) : (
        <Input id="commission_fixe" name="commission_fixe" type="number" label="Commission fixe (€)" defaultValue={apporteur?.commission_fixe?.toString() || ''} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input id="date_debut_contrat" name="date_debut_contrat" type="date" label="Début contrat" defaultValue={apporteur?.date_debut_contrat || ''} />
        <Input id="date_fin_contrat" name="date_fin_contrat" type="date" label="Fin contrat" defaultValue={apporteur?.date_fin_contrat || ''} />
      </div>

      <textarea id="conditions" name="conditions" rows={2} className="input-base resize-none" placeholder="Conditions particulières..." defaultValue={apporteur?.conditions || ''} />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" isLoading={isLoading} icon={<Save className="h-4 w-4" />}>{apporteur ? 'Mettre à jour' : 'Créer'}</Button>
      </div>
    </form>
  )
}

export function ApporteursList({ apporteurs }: ApporteursListProps) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [editApporteur, setEditApporteur] = useState<ApporteurAffaires | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet apporteur ?')) return
    const result = await deleteApporteurAction(id)
    if (result.success) toast('success', 'Apporteur supprimé')
    else toast('error', result.error || 'Erreur')
  }

  async function handleToggle(id: string, current: boolean) {
    const result = await toggleApporteurAction(id, !current)
    if (result.success) toast('success', !current ? 'Apporteur activé' : 'Apporteur désactivé')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Apporteurs d&apos;affaires</h1>
          <p className="text-surface-500 mt-1 text-sm">{apporteurs.length} apporteur{apporteurs.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouvel apporteur</Button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {apporteurs.map((a) => (
          <div key={a.id} className="card p-5 hover:shadow-card transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-50">
                  <Handshake className="h-4 w-4 text-surface-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-surface-900">
                    {a.prenom} {a.nom}
                  </div>
                  {a.raison_sociale && (
                    <div className="text-xs text-surface-500">{a.raison_sociale}</div>
                  )}
                </div>
              </div>
              <RowMenu items={[
                { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditApporteur(a) },
                {
                  label: a.is_active ? 'Désactiver' : 'Activer',
                  icon: a.is_active ? <XCircle className="h-4 w-4 text-surface-400" /> : <CheckCircle2 className="h-4 w-4 text-surface-400" />,
                  onClick: () => handleToggle(a.id, a.is_active),
                },
                { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(a.id), danger: true },
              ]} />
            </div>

            <div className="flex items-center gap-3 mb-3">
              <Badge variant={a.is_active ? 'success' : 'default'} dot>{a.is_active ? 'Actif' : 'Inactif'}</Badge>
              <div className="flex items-center gap-1 text-sm font-medium text-surface-800">
                {a.mode_calcul === 'pourcentage' ? (
                  <><Percent className="h-3.5 w-3.5 text-surface-400" /> {a.taux_commission}%</>
                ) : (
                  <><Euro className="h-3.5 w-3.5 text-surface-400" /> {a.commission_fixe?.toLocaleString('fr-FR')} €</>
                )}
              </div>
            </div>

            <div className="text-xs text-surface-500 space-y-0.5">
              {a.email && <div>{a.email}</div>}
              {a.telephone && <div>{a.telephone}</div>}
            </div>

            <div className="mt-3 pt-3 border-t border-surface-100">
              <a href={`/api/pdf/contrat-apporteur/${a.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">
                <Download className="h-3.5 w-3.5" /> Télécharger le contrat
              </a>
            </div>
          </div>
        ))}
      </div>

      {apporteurs.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Handshake className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">Aucun apporteur d&apos;affaires</p>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvel apporteur d'affaires" size="lg">
        <ApporteurForm onDone={() => setCreateOpen(false)} />
      </Modal>
      <Modal isOpen={!!editApporteur} onClose={() => setEditApporteur(null)} title="Modifier l'apporteur" size="lg">
        {editApporteur && <ApporteurForm apporteur={editApporteur} onDone={() => setEditApporteur(null)} />}
      </Modal>
    </div>
  )
}
