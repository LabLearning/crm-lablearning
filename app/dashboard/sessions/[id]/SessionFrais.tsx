'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Paperclip, Pencil, Trash2, Info, ExternalLink,
  Route, Home, Utensils, Building2, Wrench, BookOpen, Briefcase, Tag,
  type LucideIcon,
} from '@/components/ui/icons'
import { Button, Input, Select, RowMenu, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  CATEGORIES_FRAIS, euro, libelleCategorieFrais, MESSAGE_MIGRATION_FRAIS,
  type FraisVue, type LigneRentab,
} from '@/lib/rentabilite'
import { ajouterFraisAction, modifierFraisAction, supprimerFraisAction, lienJustificatifFraisAction } from './frais-actions'

const ICONES: Record<string, LucideIcon> = { Route, Home, Utensils, Building2, Wrench, BookOpen, Briefcase, Tag }
const iconeCategorie = (v: string): LucideIcon => ICONES[CATEGORIES_FRAIS.find((c) => c.valeur === v)?.icone || 'Tag'] || Tag
const TAILLE_MAX = 4 * 1024 * 1024

const dateFr = (iso: string | null) => {
  if (!iso) return null
  const [a, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

interface Props {
  /** Session de la fiche : session par défaut d'un nouveau frais */
  sessionId: string
  frais: FraisVue[]
  /** Salle / matériel saisis sur l'ancienne fiche session */
  lignesHeritees: LigneRentab[]
  /** Plusieurs entrées sur un parcours POEI : le frais se rattache à l'une de ses sessions */
  sessions: { id: string; libelle: string }[]
  formateurs: { id: string; nom: string }[]
  disponible: boolean
}

/** Frais annexes d'une session : liste, ajout et modification en ligne. */
export function SessionFrais({ sessionId, frais, lignesHeritees, sessions, formateurs, disponible }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [ouvert, setOuvert] = useState<string | null>(null) // 'nouveau' ou l'id du frais modifié
  const [occupe, setOccupe] = useState<string | null>(null)

  const nomFormateur = (id: string | null) => (id ? formateurs.find((f) => f.id === id)?.nom || null : null)
  const libelleSession = (id: string) => (sessions.length > 1 ? sessions.find((s) => s.id === id)?.libelle || null : null)

  async function ouvrirJustificatif(id: string) {
    setOccupe(id)
    const r = await lienJustificatifFraisAction(id)
    setOccupe(null)
    if (r.success && r.data) window.open(r.data.url, '_blank', 'noopener')
    else toast('error', r.error || 'Lien indisponible')
  }

  async function supprimer(f: FraisVue) {
    if (!confirm('Supprimer ce frais ?')) return
    setOccupe(f.id)
    const r = await supprimerFraisAction(f.id)
    setOccupe(null)
    if (r.success) { toast('success', 'Frais supprimé'); router.refresh() }
    else toast('error', r.error || 'Suppression impossible')
  }

  const vide = frais.length === 0 && lignesHeritees.length === 0

  return (
    <div className="space-y-2">
      {!disponible && (
        <div className="rounded-lg bg-info-50 text-info-600 px-3 py-2 text-xs flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-px" />
          <span>{MESSAGE_MIGRATION_FRAIS}</span>
        </div>
      )}

      {vide && ouvert !== 'nouveau' && (
        <p className="text-xs text-surface-500 py-1">Aucun frais annexe pour le moment.</p>
      )}

      {(frais.length > 0 || lignesHeritees.length > 0) && (
        <ul className="divide-y divide-surface-100">
          {frais.map((f) => {
            if (ouvert === f.id) {
              return (
                <li key={f.id} className="py-2">
                  <FormulaireFrais
                    initial={f}
                    sessions={sessions}
                    sessionParDefaut={f.session_id}
                    formateurs={formateurs}
                    onAnnuler={() => setOuvert(null)}
                    onFait={() => { setOuvert(null); router.refresh() }}
                  />
                </li>
              )
            }
            const Icone = iconeCategorie(f.categorie)
            const sousTitre = [libelleCategorieFrais(f.categorie), dateFr(f.date_frais), nomFormateur(f.formateur_id), libelleSession(f.session_id)]
              .filter(Boolean).join(' · ')
            return (
              <li key={f.id} className={cn('flex items-center gap-3 py-2', occupe === f.id && 'opacity-60')}>
                <span className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                  <Icone className="h-4 w-4 text-surface-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-surface-800 truncate">{f.libelle}</p>
                  <p className="text-xs text-surface-500 truncate">{sousTitre}</p>
                </div>
                {f.aJustificatif && (
                  <button type="button" onClick={() => ouvrirJustificatif(f.id)} aria-label="Voir le justificatif"
                    className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0">
                    <Paperclip className="h-4 w-4" />
                  </button>
                )}
                <span className="text-sm font-medium tabular-nums text-surface-900 whitespace-nowrap">{euro(f.montant)}</span>
                {disponible && (
                  <RowMenu
                    width={200}
                    items={[
                      { label: 'Modifier', icon: <Pencil className="h-4 w-4" />, onClick: () => setOuvert(f.id) },
                      { label: 'Voir le justificatif', icon: <ExternalLink className="h-4 w-4" />, onClick: () => ouvrirJustificatif(f.id), hidden: !f.aJustificatif },
                      { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => supprimer(f), danger: true },
                    ]}
                  />
                )}
              </li>
            )
          })}
          {lignesHeritees.map((l) => (
            <li key={l.cle} className="flex items-center gap-3 py-2">
              <span className="h-8 w-8 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-surface-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-surface-800 truncate">{l.libelle}</p>
                <p className="text-xs text-surface-500 truncate">{l.detail || 'Repris dans les frais à l\'application de la migration 149'}</p>
              </div>
              <span className="text-sm font-medium tabular-nums text-surface-900 whitespace-nowrap">{euro(l.montant)}</span>
            </li>
          ))}
        </ul>
      )}

      {disponible && ouvert === 'nouveau' && (
        <FormulaireFrais
          sessions={sessions}
          sessionParDefaut={sessionId}
          formateurs={formateurs}
          onAnnuler={() => setOuvert(null)}
          onFait={() => { setOuvert(null); router.refresh() }}
        />
      )}

      {disponible && ouvert !== 'nouveau' && (
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOuvert('nouveau')}>
          Ajouter un frais
        </Button>
      )}

      {disponible && (
        <p className="text-xs text-surface-500">
          Indiquez le montant réellement payé, TVA comprise. N&apos;ajoutez pas un frais déjà inclus dans la facture ou le contrat du formateur.
        </p>
      )}
    </div>
  )
}

function FormulaireFrais({
  initial, sessions, sessionParDefaut, formateurs, onAnnuler, onFait,
}: {
  initial?: FraisVue
  sessions: { id: string; libelle: string }[]
  sessionParDefaut: string
  formateurs: { id: string; nom: string }[]
  onAnnuler: () => void
  onFait: () => void
}) {
  const { toast } = useToast()
  const [enCours, setEnCours] = useState(false)
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})
  const id = initial?.id || 'nouveau'

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const fichier = fd.get('justificatif')
    if (fichier && typeof fichier === 'object' && (fichier as File).size > TAILLE_MAX) {
      setErreurs({ justificatif: ['Justificatif trop lourd (4 Mo maximum)'] })
      return
    }
    const cible = String(fd.get('session_id') || sessionParDefaut)
    fd.delete('session_id')
    setEnCours(true)
    setErreurs({})
    try {
      const r = initial ? await modifierFraisAction(initial.id, fd) : await ajouterFraisAction(cible, fd)
      if (r.success) { toast('success', initial ? 'Frais modifié' : 'Frais ajouté'); onFait(); return }
      if (r.errors) setErreurs(r.errors)
      if (r.error) toast('error', r.error)
    } catch {
      // Requête refusée avant d'atteindre l'action (fichier trop lourd pour l'hébergeur)
      toast('error', 'Envoi impossible : réduisez la taille du justificatif et réessayez.')
    } finally {
      setEnCours(false)
    }
  }

  const err = (champ: string) => erreurs[champ]?.[0]

  return (
    <form onSubmit={envoyer} className="rounded-xl border border-surface-200 bg-surface-50/70 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <Select
          id={`categorie-${id}`} name="categorie" label="Catégorie" required
          defaultValue={initial?.categorie || 'deplacement'}
          options={CATEGORIES_FRAIS.map((c) => ({ value: c.valeur, label: c.label }))}
          error={err('categorie')}
        />
        <div className="lg:col-span-2">
          <Input id={`libelle-${id}`} name="libelle" label="Libellé" required maxLength={120}
            defaultValue={initial?.libelle || ''} placeholder="Ex. Train Paris – Lyon aller-retour" error={err('libelle')} />
        </div>
        <Input id={`montant-${id}`} name="montant" label="Montant payé (€)" required inputMode="decimal" placeholder="0,00"
          defaultValue={initial ? String(initial.montant).replace('.', ',') : ''} error={err('montant')} className="tabular-nums" />
        <Input id={`date-${id}`} name="date_frais" type="date" label="Date"
          defaultValue={initial?.date_frais || ''} error={err('date_frais')} />
        <Select
          id={`formateur-${id}`} name="formateur_id" label="Formateur"
          defaultValue={initial?.formateur_id || ''}
          options={[{ value: '', label: 'Aucun' }, ...formateurs.map((f) => ({ value: f.id, label: f.nom }))]}
          error={err('formateur_id')}
        />
        {!initial && sessions.length > 1 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Select id={`session-${id}`} name="session_id" label="Session" defaultValue={sessionParDefaut}
              options={sessions.map((s) => ({ value: s.id, label: s.libelle }))} />
          </div>
        )}
        <div className={cn('sm:col-span-2', !initial && sessions.length > 1 ? 'lg:col-span-3' : 'lg:col-span-6')}>
          <label htmlFor={`justificatif-${id}`} className="block text-sm font-medium text-surface-700 mb-1.5">
            Justificatif <span className="font-normal text-surface-400">(facultatif, PDF ou image, 4 Mo maximum)</span>
          </label>
          <input id={`justificatif-${id}`} name="justificatif" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="block w-full text-sm text-surface-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-surface-200 file:bg-white file:text-sm file:font-medium hover:file:bg-surface-50" />
          {err('justificatif') && <p className="text-xs text-danger-600 mt-1">{err('justificatif')}</p>}
          {initial?.aJustificatif && (
            <label className="mt-1.5 flex items-center gap-2 text-xs text-surface-600 cursor-pointer">
              <input type="checkbox" name="retirer_justificatif" value="1" className="h-3.5 w-3.5 rounded border-surface-300" />
              Retirer le justificatif actuel{initial.justificatif_nom ? ` (${initial.justificatif_nom})` : ''}
            </label>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onAnnuler} disabled={enCours}>Annuler</Button>
        <Button type="submit" size="sm" isLoading={enCours}>Enregistrer</Button>
      </div>
    </form>
  )
}
