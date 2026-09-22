'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Euro, Percent, ChevronRight,
  CheckCircle2, XCircle, Save, Handshake, Download, Building2, Banknote, TrendingUp, Clock,
} from '@/components/ui/icons'
import { Button, Badge, Input, Select, Modal, useToast, CompanySearchInput, RowMenu } from '@/components/ui'
import { createApporteurAction, updateApporteurAction, deleteApporteurAction, toggleApporteurAction } from './actions'
import { nomApporteur } from '@/lib/commission-apporteur'
import type { ApporteurAffaires } from '@/lib/types/crm'
import type { SireneCompany } from '@/lib/sirene'

interface ClientLie { id: string; apporteur_id: string | null }
/** Une ligne de commission = une session terminée d'un établissement apporté. */
interface CommissionLigne { id: string; apporteur_id: string; client_id: string | null; montant_base: number | string | null; montant_commission: number | string | null; status: string | null }

interface ApporteursListProps {
  apporteurs: ApporteurAffaires[]
  clients?: ClientLie[]
  commissions?: CommissionLigne[]
  peutGerer?: boolean
}

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export function ApporteurForm({ apporteur, onDone }: { apporteur?: ApporteurAffaires; onDone: () => void }) {
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
    if (result.success) {
      toast('success', apporteur ? 'Mis à jour' : 'Apporteur créé : invitation envoyée pour créer son compte')
      if ((result as any).warning) toast('error', (result as any).warning)
      onDone()
    }
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
      <p className="text-xs text-surface-500 -mt-2">
        Calculée sur chaque formation terminée chez un établissement rattaché à cet apporteur : montant pris en charge par l&apos;OPCO, sinon prix HT de la session.
      </p>
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
        <Input id="taux_commission" name="taux_commission" type="number" step="0.5" min="0" max="100" label="Taux de commission (%)" defaultValue={apporteur?.taux_commission?.toString() || '10'} error={errors.taux_commission?.[0]} />
      ) : (
        <Input id="commission_fixe" name="commission_fixe" type="number" step="1" min="0" label="Commission fixe (€) par formation réalisée" defaultValue={apporteur?.commission_fixe?.toString() || ''} error={errors.commission_fixe?.[0]} />
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

/**
 * Cartes des apporteurs : chaque carte ouvre la fiche (établissements,
 * commissions à valider et à verser). Le menu et le contrat restent
 * accessibles par-dessus le lien.
 */
export function ApporteursList({ apporteurs, clients = [], commissions = [], peutGerer = true }: ApporteursListProps) {
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

  const actives = commissions.filter((c) => c.status !== 'annulee')
  const somme = (l: CommissionLigne[], champ: 'montant_base' | 'montant_commission') => l.reduce((s, c) => s + Number(c[champ] || 0), 0)
  const statsFor = (aid: string) => {
    const etabs = clients.filter((c) => c.apporteur_id === aid).length
    const cs = actives.filter((c) => c.apporteur_id === aid)
    return {
      etabs,
      formations: cs.length,
      base: somme(cs, 'montant_base'),
      aVerser: somme(cs.filter((c) => c.status === 'validee'), 'montant_commission'),
      enAttente: somme(cs.filter((c) => c.status === 'en_attente'), 'montant_commission'),
      versees: somme(cs.filter((c) => c.status === 'payee'), 'montant_commission'),
    }
  }
  const totalAVerser = somme(actives.filter((c) => c.status === 'validee'), 'montant_commission')
  const totalEnAttente = somme(actives.filter((c) => c.status === 'en_attente'), 'montant_commission')
  const totalVersees = somme(actives.filter((c) => c.status === 'payee'), 'montant_commission')
  const nbActifs = apporteurs.filter((a) => a.is_active).length

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Apporteurs d&apos;affaires</h1>
          <p className="text-surface-500 mt-1 text-sm">Établissements apportés, commissions à valider et à verser. Cliquez sur un apporteur pour gérer ses commissions.</p>
        </div>
        {peutGerer && <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />} className="w-full sm:w-auto">Nouvel apporteur</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Handshake} tint="brand" label="Apporteurs" value={String(apporteurs.length)} sous={apporteurs.length ? `${nbActifs} actif${nbActifs > 1 ? 's' : ''}` : undefined} />
        <Kpi icon={Building2} tint="blue" label="Établissements apportés" value={String(clients.length)} />
        <Kpi icon={Banknote} tint="amber" label="Commissions à verser HT" value={fmtEuro(totalAVerser)} sous={totalEnAttente > 0 ? `${fmtEuro(totalEnAttente)} en attente d’encaissement` : undefined} />
        <Kpi icon={TrendingUp} tint="emerald" label="Commissions versées HT" value={fmtEuro(totalVersees)} />
      </div>

      {apporteurs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <Handshake className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucun apporteur d&apos;affaires</p>
          <p className="text-xs text-surface-400 mt-1">Créez l&apos;apporteur avec son taux, puis choisissez-le sur la fiche de chaque client qu&apos;il vous apporte.</p>
          {peutGerer && (
            <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />} className="mt-4">Créer un apporteur</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {apporteurs.map((a) => {
            const st = statsFor(a.id)
            const nom = nomApporteur(a as any)
            const personne = `${a.prenom || ''} ${a.nom || ''}`.trim()
            return (
              <div key={a.id} className="card p-5 relative hover:border-brand-300 transition-colors group">
                {/* Lien étiré : toute la carte ouvre la fiche */}
                <Link href={`/dashboard/apporteurs/${a.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Ouvrir la fiche de ${nom}`} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Handshake className="h-4 w-4 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-surface-900 truncate group-hover:text-brand-600 transition-colors">{nom}</h3>
                      <div className="text-xs text-surface-500 truncate">
                        {[personne && personne !== nom ? personne : null, a.email, a.telephone].filter(Boolean).join(' · ') || 'Coordonnées à compléter'}
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 flex items-center gap-1 shrink-0">
                    {peutGerer && (
                      <RowMenu items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4 text-surface-400" />, onClick: () => setEditApporteur(a) },
                        {
                          label: a.is_active ? 'Désactiver' : 'Activer',
                          icon: a.is_active ? <XCircle className="h-4 w-4 text-surface-400" /> : <CheckCircle2 className="h-4 w-4 text-surface-400" />,
                          onClick: () => handleToggle(a.id, a.is_active),
                        },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleDelete(a.id), danger: true },
                      ]} />
                    )}
                    <ChevronRight className="h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors" />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <Badge variant={a.is_active ? 'success' : 'default'} dot>{a.is_active ? 'Actif' : 'Inactif'}</Badge>
                  <div className="flex items-center gap-1 text-sm font-medium text-surface-800">
                    {a.mode_calcul === 'fixe' ? (
                      <><Euro className="h-3.5 w-3.5 text-surface-400" /> {Number(a.commission_fixe || 0).toLocaleString('fr-FR')} € par formation</>
                    ) : (
                      <><Percent className="h-3.5 w-3.5 text-surface-400" /> {Number(a.taux_commission || 0).toLocaleString('fr-FR')} % du montant HT</>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <Mini label="Établissements" value={String(st.etabs)} />
                  <Mini label="Formations" value={String(st.formations)} />
                  <Mini label="Base HT" value={fmtEuro(st.base)} />
                </div>

                <div className="mt-3 pt-3 border-t border-surface-100 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="relative z-10 flex items-center gap-3">
                    <a href={`/api/pdf/contrat-apporteur/${a.id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-brand-600 transition-colors">
                      <Download className="h-3.5 w-3.5" /> Contrat
                    </a>
                    {st.enAttente > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-surface-500 tabular-nums">
                        <Clock className="h-3.5 w-3.5" /> {fmtEuro(st.enAttente)} en attente
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${st.aVerser > 0 ? 'text-amber-600' : 'text-surface-400'}`}>
                    {fmtEuro(st.aVerser)} <span className="text-[11px] font-normal text-surface-400">à verser</span>
                  </span>
                </div>
              </div>
            )
          })}
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

function Kpi({ icon: Icon, tint, label, value, sous }: { icon: any; tint: string; label: string; value: string; sous?: string }) {
  const tints: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tints[tint] || tints.brand}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-heading font-bold text-surface-900 tabular-nums leading-tight truncate">{value}</div>
        <div className="text-[11px] text-surface-500 truncate">{label}</div>
        {sous && <div className="text-[11px] text-surface-400 truncate">{sous}</div>}
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-50 px-2.5 py-2 min-w-0">
      <div className="text-sm font-semibold text-surface-900 tabular-nums truncate">{value}</div>
      <div className="text-[10px] text-surface-400 uppercase tracking-wider truncate">{label}</div>
    </div>
  )
}
