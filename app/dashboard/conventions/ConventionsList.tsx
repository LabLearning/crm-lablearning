'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, MoreHorizontal, Send, Check, Trash2,
  FileSignature, Building2, Euro, Clock, PenTool, Download, Link2, Copy,
} from 'lucide-react'
import { Button, Badge, Modal, Input, Select, useToast } from '@/components/ui'
import { createConventionAction, updateConventionStatusAction, deleteConventionAction } from './actions'
import { CONVENTION_STATUS_LABELS, CONVENTION_STATUS_COLORS, CONVENTION_TYPE_LABELS } from '@/lib/types/dossier'
import { FINANCEUR_LABELS } from '@/lib/types/crm'
import { formatDate } from '@/lib/utils'
import type { Convention, ConventionStatus, ConventionType } from '@/lib/types/dossier'
import type { Client } from '@/lib/types/crm'
import type { Formation } from '@/lib/types/formation'

interface ConventionsListProps {
  conventions: Convention[]
  clients: Pick<Client, 'id' | 'raison_sociale'>[]
  formations: Pick<Formation, 'id' | 'intitule' | 'duree_heures'>[]
}

const typeOptions = Object.entries(CONVENTION_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const financeurOptions = [{ value: '', label: 'Aucun' }, ...Object.entries(FINANCEUR_LABELS).map(([v, l]) => ({ value: v, label: l }))]

export function ConventionsList({ conventions, clients, formations }: ConventionsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'pending' | 'signed'>('all')

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.raison_sociale || c.id }))
  const formationOptions = formations.map((f) => ({ value: f.id, label: f.intitule }))

  // Compteurs par onglet
  const pendingCount = conventions.filter(c => ['brouillon', 'envoyee'].includes(c.status)).length
  const signedCount = conventions.filter(c => ['signee_client', 'signee_of', 'signee_complete'].includes(c.status)).length

  const filtered = useMemo(() => {
    let result = conventions

    // Filtre par onglet
    if (tab === 'pending') {
      result = result.filter(c => ['brouillon', 'envoyee'].includes(c.status))
    } else if (tab === 'signed') {
      result = result.filter(c => ['signee_client', 'signee_of', 'signee_complete'].includes(c.status))
    }

    // Filtre recherche texte
    if (search) {
      const s = search.toLowerCase()
      result = result.filter((c) =>
        c.numero.toLowerCase().includes(s) ||
        (c.client?.raison_sociale || '').toLowerCase().includes(s) ||
        (c.objet || '').toLowerCase().includes(s)
      )
    }

    return result
  }, [conventions, search, tab])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsCreating(true); setErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await createConventionAction(fd)
    if (result.success) { toast('success', 'Convention créée'); setCreateOpen(false) }
    else if (result.errors) setErrors(result.errors)
    else toast('error', result.error || 'Erreur')
    setIsCreating(false)
  }

  async function handleStatus(id: string, status: ConventionStatus) {
    const result = await updateConventionStatusAction(id, status)
    if (result.success) toast('success', `Statut mis à jour : ${CONVENTION_STATUS_LABELS[status]}`)
    else toast('error', result.error || 'Erreur')
    setActiveMenu(null)
  }

  async function handleGenerateSignatureLink(id: string) {
    const { generateSignatureLinkAction } = await import('./signature-actions')
    const r = await generateSignatureLinkAction(id)
    if (r.success && (r.data as any)?.url) {
      const url = (r.data as any).url
      try {
        await navigator.clipboard.writeText(url)
        toast('success', 'Lien copié dans le presse-papier — envoyez-le au client')
      } catch {
        toast('success', 'Lien généré : ' + url)
      }
    } else toast('error', r.error || 'Erreur')
    setActiveMenu(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette convention ?')) return
    const result = await deleteConventionAction(id)
    if (result.success) toast('success', 'Convention supprimée')
    else toast('error', result.error || 'Erreur')
    setActiveMenu(null)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Conventions</h1>
          <p className="text-surface-500 mt-1 text-sm">{conventions.length} convention{conventions.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Nouvelle convention</Button>
      </div>

      {/* Onglets de filtre */}
      <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5 max-w-md mb-4">
        {([
          { id: 'all' as const, label: 'Toutes', count: conventions.length },
          { id: 'pending' as const, label: 'En attente de signature', count: pendingCount },
          { id: 'signed' as const, label: 'Signées', count: signedCount },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === t.id ? 'bg-white shadow-xs text-surface-900' : 'text-surface-500 hover:text-surface-800'
            }`}
          >
            {t.label}
            <span className={`text-2xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-surface-200/60 max-w-md mb-5">
        <Search className="h-4 w-4 text-surface-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-transparent text-sm placeholder:text-surface-400 focus:outline-none flex-1" />
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="card p-5 hover:shadow-card hover:border-brand-200 transition-all cursor-pointer"
            onClick={() => router.push(`/dashboard/conventions/${c.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono font-medium text-brand-600">{c.numero}</span>
                  <Badge variant={CONVENTION_STATUS_COLORS[c.status]} dot>{CONVENTION_STATUS_LABELS[c.status]}</Badge>
                  <Badge variant="default">{CONVENTION_TYPE_LABELS[c.type]}</Badge>
                </div>
                <div className="text-sm text-surface-700 mb-2">{c.objet || c.formation?.intitule || '—'}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{c.client?.raison_sociale || '—'}</span>
                  <span className="flex items-center gap-1"><Euro className="h-3.5 w-3.5" />{Number(c.montant_ttc).toLocaleString('fr-FR')} € TTC</span>
                  {c.duree_heures && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.duree_heures}h</span>}
                  {c.nombre_stagiaires > 1 && <span>{c.nombre_stagiaires} stagiaires</span>}
                  {c.financeur_type && <Badge variant="warning">{FINANCEUR_LABELS[c.financeur_type as keyof typeof FINANCEUR_LABELS] || c.financeur_type}</Badge>}
                </div>
                {/* Signature status */}
                <div className="flex gap-3 mt-2">
                  <div className={`flex items-center gap-1 text-xs ${c.signature_client_date ? 'text-success-600' : 'text-surface-400'}`}>
                    <PenTool className="h-3 w-3" />
                    Client {c.signature_client_date ? `signé ${formatDate(c.signature_client_date, { day: 'numeric', month: 'short' })}` : 'en attente'}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${c.signature_of_date ? 'text-success-600' : 'text-surface-400'}`}>
                    <PenTool className="h-3 w-3" />
                    OF {c.signature_of_date ? `signé ${formatDate(c.signature_of_date, { day: 'numeric', month: 'short' })}` : 'en attente'}
                  </div>
                </div>
              </div>
              {/* Bouton direct "Renvoyer en signature" si convention pas encore signée */}
              {['brouillon', 'envoyee'].includes(c.status) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => { e.stopPropagation(); handleGenerateSignatureLink(c.id) }}
                  icon={<Send className="h-3.5 w-3.5" />}
                  className="ml-3 shrink-0"
                >
                  Renvoyer en signature
                </Button>
              )}
              <div className="relative ml-3" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setActiveMenu(activeMenu === c.id ? null : c.id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {activeMenu === c.id && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border shadow-elevated py-1 z-20 animate-in-scale origin-top-right">
                    <a href={`/api/pdf/convention/${c.id}`} target="_blank" rel="noopener noreferrer" onClick={() => setActiveMenu(null)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50">
                      <Download className="h-4 w-4 text-surface-400" /> Télécharger PDF
                    </a>
                    <button onClick={() => handleGenerateSignatureLink(c.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50">
                      <Link2 className="h-4 w-4" /> Lien de signature électronique
                    </button>
                    {c.status === 'brouillon' && (
                      <button onClick={() => handleStatus(c.id, 'envoyee')} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50">
                        <Send className="h-4 w-4" /> Marquer envoyée
                      </button>
                    )}
                    {c.status === 'envoyee' && (
                      <button onClick={() => handleStatus(c.id, 'signee_client')} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-success-600 hover:bg-success-50">
                        <Check className="h-4 w-4" /> Signée par le client
                      </button>
                    )}
                    {c.status === 'signee_client' && (
                      <button onClick={() => handleStatus(c.id, 'signee_complete')} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-success-600 hover:bg-success-50">
                        <Check className="h-4 w-4" /> Signature complète
                      </button>
                    )}
                    {['brouillon', 'envoyee'].includes(c.status) && (
                      <button onClick={() => handleDelete(c.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50">
                        <Trash2 className="h-4 w-4" /> Supprimer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-14 px-8">
          <FileSignature className="h-6 w-6 text-surface-400" />
          <p className="text-sm text-surface-500">Aucune convention</p>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle convention" size="lg">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Select id="type" name="type" label="Type *" options={typeOptions} defaultValue="inter_entreprise" />
          <Select id="client_id" name="client_id" label="Client *" options={clientOptions} placeholder="Sélectionner" error={errors.client_id?.[0]} />
          <Select id="formation_id" name="formation_id" label="Formation *" options={formationOptions} placeholder="Sélectionner" error={errors.formation_id?.[0]} />
          <Input id="objet" name="objet" label="Objet" placeholder="Convention de formation — Management" />
          <div className="grid grid-cols-3 gap-3">
            <Input id="nombre_stagiaires" name="nombre_stagiaires" type="number" label="Nb stagiaires" defaultValue="1" />
            <Input id="duree_heures" name="duree_heures" type="number" label="Durée (h)" />
            <Input id="lieu" name="lieu" label="Lieu" />
          </div>
          <Input id="dates_formation" name="dates_formation" label="Dates de formation" placeholder="Du 15/03 au 17/03/2024" />
          <div className="grid grid-cols-2 gap-3">
            <Input id="montant_ht" name="montant_ht" type="number" label="Montant HT (€) *" error={errors.montant_ht?.[0]} />
            <Input id="taux_tva" name="taux_tva" type="number" label="Taux TVA (%)" defaultValue="20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select id="financeur_type" name="financeur_type" label="Financeur" options={financeurOptions} />
            <Input id="financeur_nom" name="financeur_nom" label="Nom du financeur" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isCreating} icon={<FileSignature className="h-4 w-4" />}>Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
