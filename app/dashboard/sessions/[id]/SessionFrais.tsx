'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Paperclip, Pencil, Trash2, Info, ExternalLink, CheckCircle2, Clock, CalendarCheck, RotateCcw,
  Route, Home, Utensils, Building2, Wrench, BookOpen, Briefcase, Tag, UserCheck,
  type LucideIcon,
} from '@/components/ui/icons'
import { Button, Input, Select, RowMenu, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  CATEGORIES_FRAIS, euro, libelleCategorieFrais, MESSAGE_MIGRATION_FRAIS,
  type FraisVue, type LigneRentab,
} from '@/lib/rentabilite'
import {
  ajouterFraisAction, modifierFraisAction, supprimerFraisAction, lienJustificatifFraisAction, marquerFraisPayeAction,
} from './frais-actions'

const ICONES: Record<string, LucideIcon> = { Route, Home, Utensils, Building2, Wrench, BookOpen, Briefcase, Tag, UserCheck }
const iconeCategorie = (v: string): LucideIcon => ICONES[CATEGORIES_FRAIS.find((c) => c.valeur === v)?.icone || 'Tag'] || Tag
const TAILLE_MAX = 4 * 1024 * 1024

const dateFr = (iso: string | null) => {
  if (!iso) return null
  const [a, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

/** « 24/11 » dans l'année en cours, « 24/11/2025 » sinon */
const dateCourte = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split('-')
  return a === String(new Date().getFullYear()) ? `${j}/${m}` : `${j}/${m}/${a}`
}

const aujourdhui = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  /** Colonne paye_le présente (migration 174) : pastille Payé / À payer */
  paiementDisponible?: boolean
}

/** Frais annexes d'une session : liste, ajout et modification en ligne. */
export function SessionFrais({ sessionId, frais, lignesHeritees, sessions, formateurs, disponible, paiementDisponible = false }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [ouvert, setOuvert] = useState<string | null>(null) // 'nouveau', l'id du frais modifié, ou 'paiement:<id>'
  const [occupe, setOccupe] = useState<string | null>(null)
  // Paiement noté à l'instant, affiché sans attendre le rafraîchissement de la page
  const [payes, setPayes] = useState<Record<string, string | null>>({})
  const payeLe = (f: FraisVue) => (f.id in payes ? payes[f.id] : f.paye_le)
  const suiviPaiement = disponible && paiementDisponible

  async function noterPaiement(f: FraisVue, date: string | null) {
    setOccupe(f.id)
    const r = await marquerFraisPayeAction(f.id, date)
    setOccupe(null)
    if (r.success) {
      setPayes((p) => ({ ...p, [f.id]: r.data?.paye_le ?? null }))
      setOuvert(null)
      toast('success', r.data?.paye_le ? `Frais payé le ${dateFr(r.data.paye_le)}` : 'Frais remis à payer')
      router.refresh()
    } else toast('error', r.error || 'Enregistrement impossible')
  }

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
            const paye = payeLe(f)
            return (
              <li key={f.id} className={cn('py-2', occupe === f.id && 'opacity-60')}>
                <div className="flex items-center gap-3">
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
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-medium tabular-nums text-surface-900 whitespace-nowrap">{euro(f.montant)}</span>
                    {suiviPaiement && (
                      <PastillePaiement
                        payeLe={paye}
                        occupe={occupe === f.id}
                        // À payer : un clic le note payé aujourd'hui ; payé : on corrige la date ou on le remet à payer
                        onClick={() => (paye ? setOuvert(ouvert === `paiement:${f.id}` ? null : `paiement:${f.id}`) : noterPaiement(f, ''))}
                      />
                    )}
                  </div>
                  {disponible && (
                    <RowMenu
                      width={220}
                      items={[
                        { label: 'Modifier', icon: <Pencil className="h-4 w-4" />, onClick: () => setOuvert(f.id) },
                        { label: 'Marquer payé', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => noterPaiement(f, ''), hidden: !suiviPaiement || !!paye },
                        { label: 'Date du paiement', icon: <CalendarCheck className="h-4 w-4" />, onClick: () => setOuvert(`paiement:${f.id}`), hidden: !suiviPaiement },
                        { label: 'Remettre à payer', icon: <RotateCcw className="h-4 w-4" />, onClick: () => noterPaiement(f, null), hidden: !suiviPaiement || !paye },
                        { label: 'Voir le justificatif', icon: <ExternalLink className="h-4 w-4" />, onClick: () => ouvrirJustificatif(f.id), hidden: !f.aJustificatif },
                        { label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: () => supprimer(f), danger: true },
                      ]}
                    />
                  )}
                </div>
                {suiviPaiement && ouvert === `paiement:${f.id}` && (
                  <DatePaiement
                    id={f.id}
                    initial={paye}
                    occupe={occupe === f.id}
                    onValider={(date) => noterPaiement(f, date)}
                    onRemettre={paye ? () => noterPaiement(f, null) : undefined}
                    onAnnuler={() => setOuvert(null)}
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

      {suiviPaiement && frais.length > 0 && (() => {
        const total = (liste: FraisVue[]) => liste.reduce((a, f) => a + f.montant, 0)
        const regles = frais.filter((f) => !!payeLe(f))
        const restants = frais.filter((f) => !payeLe(f))
        return (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-surface-50 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-success-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Payé <span className="tabular-nums font-semibold">{euro(total(regles))}</span>
            </span>
            <span className={cn('inline-flex items-center gap-1.5', restants.length ? 'text-warning-700' : 'text-surface-500')}>
              <Clock className="h-3.5 w-3.5" />
              À payer <span className="tabular-nums font-semibold">{euro(total(restants))}</span>
              {restants.length > 0 && <span className="text-surface-500">({restants.length} frais)</span>}
            </span>
          </div>
        )
      })()}

      {disponible && !paiementDisponible && frais.length > 0 && (
        <p className="text-xs text-surface-500">
          Pour noter les frais payés, la migration 174 (supabase/migrations/174_frais_paiement.sql) doit être appliquée.
        </p>
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

/** Pastille cliquable : « Payé le 24/11 » (vert) ou « À payer » (ambre). */
function PastillePaiement({ payeLe, occupe, onClick }: { payeLe: string | null; occupe: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={occupe}
      aria-label={payeLe ? `Payé le ${dateFr(payeLe)} : modifier` : 'À payer : marquer payé aujourd’hui'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold leading-4 whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-400/50 disabled:opacity-60',
        payeLe
          ? 'bg-success-50 text-success-700 hover:bg-success-100'
          : 'bg-warning-50 text-warning-700 hover:bg-warning-100',
      )}
    >
      {payeLe ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {payeLe ? `Payé le ${dateCourte(payeLe)}` : 'À payer'}
    </button>
  )
}

/** Date du règlement d'un frais : correction, ou retour à « À payer ». */
function DatePaiement({ id, initial, occupe, onValider, onRemettre, onAnnuler }: {
  id: string
  initial: string | null
  occupe: boolean
  onValider: (date: string) => void
  onRemettre?: () => void
  onAnnuler: () => void
}) {
  const [date, setDate] = useState(initial || aujourdhui())
  return (
    <div className="mt-2 ml-11 flex flex-wrap items-end gap-2 rounded-xl border border-surface-200 bg-surface-50/70 p-3">
      <div className="w-44">
        <Input id={`paye-le-${id}`} type="date" label="Payé le" value={date} max={aujourdhui()}
          onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" isLoading={occupe} disabled={!date} onClick={() => onValider(date)}>Enregistrer</Button>
        {onRemettre && (
          <Button type="button" variant="secondary" size="sm" disabled={occupe} onClick={onRemettre}
            icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Remettre à payer
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={occupe} onClick={onAnnuler}>Annuler</Button>
      </div>
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
