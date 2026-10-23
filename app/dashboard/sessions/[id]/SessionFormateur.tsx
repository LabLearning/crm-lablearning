'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GraduationCap, Mail, Phone, Euro, ExternalLink, UserCog, UserPlus, AlertTriangle,
  CheckCircle2, Clock, XCircle, Loader2, PenTool, History, ReceiptEuro, Download, TrendingUp,
} from '@/components/ui/icons'
import { Avatar, Badge, Button, Modal, SearchSelect, FormateurDispoBadge, useToast } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import type { BadgeVariant } from '@/lib/types'
import { updateCoutFormateurAction } from './actions'
import { changerFormateurSessionAction } from './formateur-actions'
import { SessionDocuments } from './SessionDocuments'

interface FormateurFiche {
  id: string
  civilite?: string | null
  prenom: string | null
  nom: string | null
  email?: string | null
  telephone?: string | null
  type_contrat?: string | null
  siret?: string | null
  numero_da?: string | null
  taux_tva?: number | null
  tarif_journalier?: number | null
  tarif_horaire?: number | null
  zone_intervention?: string | null
  domaines_expertise?: string[] | null
  is_active?: boolean | null
  a_verifier?: boolean | null
  photo_url?: string | null
}

interface FormateurRef {
  id: string
  prenom: string | null
  nom: string | null
  tarif_journalier: number | null
  zone_intervention?: string | null
  a_verifier?: boolean | null
}

interface ContratLigne {
  id: string
  numero: string | null
  status: string | null
  formateur_id: string | null
  montant_ht: number | null
  sent_at: string | null
  signature_formateur_date: string | null
  created_at: string
  formateur?: { prenom: string | null; nom: string | null } | null
}

interface FactureLigne {
  id: string
  numero: string | null
  reference_externe: string | null
  formateur_id: string | null
  montant_ht: number | null
  status: string | null
  date_emission: string | null
  date_paiement: string | null
}

interface Props {
  session: any
  /** Fiche complète du formateur (colonnes nommées), sinon le formateur joint à la session */
  formateur: FormateurFiche | null
  formateurs: FormateurRef[]
  /** Contrat en vigueur du formateur actuel */
  contrat: any | null
  /** Tous les contrats de la session, annulés compris */
  contrats: ContratLigne[]
  factures: FactureLigne[]
  docEmailLogs: any[]
  missionProposeePar: string | null
  nbJours: number
  peutGerer: boolean
  /** Le compte peut ouvrir les fiches formateur (module Formateurs) */
  peutVoirFiche: boolean
  peutFixerRemuneration: boolean
  formationNom: string | null
  dates: string
  onVoirRentabilite?: () => void
}

const STATUT_FORMATEUR: Record<string, string> = { salarie: 'Salarié', prestataire: 'Prestataire', sous_traitance: 'Sous-traitance', benevole: 'Bénévole' }

const MISSION: Record<string, { label: string; cls: string; Icon: any }> = {
  pending: { label: 'Mission proposée, en attente de sa réponse', cls: 'bg-warning-50 text-warning-700', Icon: Clock },
  accepted: { label: 'Mission acceptée', cls: 'bg-success-50 text-success-700', Icon: CheckCircle2 },
  refused: { label: 'Mission refusée', cls: 'bg-danger-50 text-danger-700', Icon: XCircle },
  not_required: { label: 'Affecté directement, sans proposition de mission', cls: 'bg-surface-100 text-surface-600', Icon: UserCog },
}

const STATUT_CONTRAT: Record<string, { label: string; variant: BadgeVariant }> = {
  brouillon: { label: 'Brouillon', variant: 'default' },
  envoye: { label: 'Envoyé', variant: 'info' },
  signe_formateur: { label: 'Signé', variant: 'success' },
  annule: { label: 'Annulé', variant: 'danger' },
}

const STATUT_FACTURE: Record<string, { label: string; variant: BadgeVariant }> = {
  brouillon: { label: 'Brouillon', variant: 'default' },
  envoyee: { label: 'À valider', variant: 'warning' },
  validee: { label: 'Validée', variant: 'info' },
  payee: { label: 'Payée', variant: 'success' },
  rejetee: { label: 'Rejetée', variant: 'danger' },
}

const euros = (n: number | string | null | undefined) =>
  `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
const nomDe = (f: { prenom?: string | null; nom?: string | null } | null | undefined) =>
  [f?.prenom, f?.nom].filter(Boolean).join(' ').trim()
const jourCourt = (d: string) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })

export function SessionFormateur({
  session, formateur, formateurs, contrat, contrats, factures, docEmailLogs, missionProposeePar,
  nbJours, peutGerer, peutVoirFiche, peutFixerRemuneration, formationNom, dates, onVoirRentabilite,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [changerOuvert, setChangerOuvert] = useState(false)
  const [editCout, setEditCout] = useState(false)
  const [coutValue, setCoutValue] = useState('')

  const cout = session.cout_formateur != null ? Number(session.cout_formateur) : null
  const tarif = formateur?.tarif_journalier != null ? Number(formateur.tarif_journalier) : null
  const suggestion = tarif && nbJours > 0 ? Math.round(tarif * nbJours * 100) / 100 : null
  const contratActif = contrat && contrat.status !== 'annule' ? contrat : null
  const contratSigne = !!(contratActif && (contratActif.signature_formateur_date || contratActif.status === 'signe_formateur'))
  const ecartContrat = contratSigne && contratActif.montant_ht != null && cout != null
    && Math.abs(Number(contratActif.montant_ht) - cout) > 0.005
  const autresContrats = contrats.filter((c) => c.id !== contratActif?.id)
  const nomsFormateurs = new Map<string, string>([
    ...formateurs.map((f) => [f.id, nomDe(f)] as [string, string]),
    ...contrats.filter((c) => c.formateur_id && c.formateur).map((c) => [c.formateur_id as string, nomDe(c.formateur)] as [string, string]),
    ...(formateur ? [[formateur.id, nomDe(formateur)] as [string, string]] : []),
  ])
  // Un refus visait le formateur précédent (le refus retire le formateur de la session)
  const mission = session.mission_status === 'refused' ? null : MISSION[session.mission_status as string]

  function ouvrirEditionCout(valeur: number | null) {
    setCoutValue(valeur != null ? String(valeur) : '')
    setEditCout(true)
  }

  function enregistrerCout() {
    const brut = coutValue.trim().replace(',', '.')
    const montant = brut === '' ? null : Number(brut)
    if (montant !== null && (!Number.isFinite(montant) || montant < 0)) { toast('error', 'Montant invalide'); return }
    startTransition(async () => {
      const r = await updateCoutFormateurAction(session.id, montant)
      if (r.success) {
        setEditCout(false)
        toast('success', (r as any).data?.contratMisAJour ? 'Rémunération enregistrée, contrat mis à jour' : 'Rémunération enregistrée')
        router.refresh()
      } else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Formateur de la session ── */}
      {formateur ? (
        <div className="card overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar firstName={formateur.prenom || ''} lastName={formateur.nom || ''} src={formateur.photo_url} size="lg" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {peutVoirFiche ? (
                    <Link href={`/dashboard/formateurs/${formateur.id}`} className="text-base font-heading font-bold text-surface-900 hover:text-brand-600 transition-colors [overflow-wrap:anywhere]">
                      {[formateur.civilite, formateur.prenom, formateur.nom].filter(Boolean).join(' ')}
                    </Link>
                  ) : (
                    <span className="text-base font-heading font-bold text-surface-900 [overflow-wrap:anywhere]">
                      {[formateur.civilite, formateur.prenom, formateur.nom].filter(Boolean).join(' ')}
                    </span>
                  )}
                  {formateur.type_contrat && <Badge variant="default">{STATUT_FORMATEUR[formateur.type_contrat] || formateur.type_contrat}</Badge>}
                  {formateur.is_active === false && <Badge variant="warning">Fiche désactivée</Badge>}
                  {formateur.a_verifier && <Badge variant="warning">Fiche à vérifier</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500">
                  {formateur.email && (
                    <a href={`mailto:${formateur.email}`} className="inline-flex items-center gap-1 min-w-0 hover:text-brand-600">
                      <Mail className="h-3.5 w-3.5 shrink-0" /><span className="[overflow-wrap:anywhere]">{formateur.email}</span>
                    </a>
                  )}
                  {formateur.telephone && (
                    <a href={`tel:${formateur.telephone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                      <Phone className="h-3.5 w-3.5 shrink-0" />{formateur.telephone}
                    </a>
                  )}
                </div>
                {mission && (
                  <div className={cn('mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', mission.cls)}>
                    <mission.Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {mission.label}
                      {session.mission_status === 'pending' && session.mission_proposed_at && <> · proposée le {jourCourt(session.mission_proposed_at)}{missionProposeePar ? ` par ${missionProposeePar}` : ''}</>}
                      {session.mission_status === 'accepted' && session.mission_responded_at && <> le {jourCourt(session.mission_responded_at)}</>}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {peutVoirFiche && (
                <Link href={`/dashboard/formateurs/${formateur.id}`}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-surface-200 px-3 py-2 min-h-[40px] text-sm font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
                </Link>
              )}
              {peutGerer && (
                <button type="button" onClick={() => setChangerOuvert(true)}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 min-h-[40px] text-sm font-medium text-white hover:bg-brand-600 transition-colors">
                  <UserCog className="h-4 w-4" /> Changer de formateur
                </button>
              )}
            </div>
          </div>

          {/* Informations de la fiche formateur */}
          {(() => {
            const infos: [string, string][] = [
              ...(tarif != null ? [['Tarif journalier', `${euros(tarif)} HT`] as [string, string]] : []),
              ...(formateur.tarif_horaire != null ? [['Tarif horaire', `${euros(formateur.tarif_horaire)} HT`] as [string, string]] : []),
              ...(formateur.taux_tva != null ? [['TVA', Number(formateur.taux_tva) === 0 ? 'Sans TVA' : `${Number(formateur.taux_tva).toLocaleString('fr-FR')} %`] as [string, string]] : []),
              ...(formateur.siret ? [['SIRET', formateur.siret] as [string, string]] : []),
              ...(formateur.numero_da ? [["Déclaration d'activité", formateur.numero_da] as [string, string]] : []),
              ...(formateur.zone_intervention ? [["Zone d'intervention", formateur.zone_intervention] as [string, string]] : []),
            ]
            const domaines = (formateur.domaines_expertise || []).filter(Boolean)
            if (!infos.length && !domaines.length) return null
            return (
              <div className="border-t border-surface-100 bg-surface-50/40 px-4 py-3 space-y-3">
                {infos.length > 0 && (
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                    {infos.map(([label, valeur]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-2xs uppercase tracking-wider text-surface-400">{label}</dt>
                        <dd className="text-sm text-surface-800 [overflow-wrap:anywhere] tabular-nums">{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {domaines.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {domaines.slice(0, 12).map((d) => <Badge key={d} variant="info">{d}</Badge>)}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-surface-100 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-surface-400" />
          </span>
          <div>
            <p className="text-sm font-medium text-surface-900">Aucun formateur sur cette session</p>
            {session.mission_status === 'refused' ? (
              <p className="mt-1 text-sm text-surface-500 max-w-md">
                La dernière proposition de mission a été refusée{session.mission_responded_at ? ` le ${jourCourt(session.mission_responded_at)}` : ''}
                {session.mission_response_comment ? <> : « {session.mission_response_comment} »</> : null}.
              </p>
            ) : peutGerer ? (
              <p className="mt-1 text-sm text-surface-500">Choisissez le formateur qui animera la formation.</p>
            ) : null}
          </div>
          {peutGerer && (
            <Button onClick={() => setChangerOuvert(true)} icon={<UserPlus className="h-4 w-4" />}>Affecter un formateur</Button>
          )}
        </div>
      )}

      {/* ── Rémunération ── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-xl bg-success-50 flex items-center justify-center shrink-0">
            <Euro className="h-5 w-5 text-success-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-surface-400 leading-none">Rémunération du formateur (HT)</div>
            <div className="text-lg font-heading font-bold text-surface-900 mt-1 tabular-nums">
              {cout != null ? euros(cout) : <span className="text-sm font-normal text-surface-400">À définir</span>}
            </div>
            <div className="text-2xs text-surface-500 mt-0.5">Reprise sur le contrat tant qu&apos;il n&apos;est pas signé.</div>
          </div>
          {peutFixerRemuneration && (
            editCout ? (
              <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal" autoFocus value={coutValue}
                    onChange={(e) => setCoutValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') enregistrerCout(); if (e.key === 'Escape') setEditCout(false) }}
                    placeholder={suggestion != null ? String(suggestion) : '0'}
                    aria-label="Rémunération du formateur en euros hors taxes"
                    className="w-full sm:w-32 pl-3 pr-7 py-2 min-h-[40px] sm:min-h-0 rounded-xl border border-brand-300 bg-white text-sm font-semibold text-surface-900 text-right focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-surface-400 pointer-events-none">€</span>
                </div>
                <button type="button" onClick={enregistrerCout} disabled={pending} aria-label="Enregistrer la rémunération"
                  className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setEditCout(false)} aria-label="Annuler"
                  className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl border border-surface-200 text-surface-400 hover:bg-surface-50 hover:text-surface-600 transition-colors">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => ouvrirEditionCout(cout)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] sm:min-h-0 rounded-xl border border-surface-200 text-surface-600 text-sm font-medium hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600 transition-colors shrink-0 w-full sm:w-auto">
                <PenTool className="h-3.5 w-3.5" /> Modifier
              </button>
            )
          )}
        </div>

        {suggestion != null && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
            <span className="tabular-nums">
              Tarif de sa fiche : {euros(tarif)} / jour × {nbJours} jour{nbJours > 1 ? 's' : ''} = {euros(suggestion)}
            </span>
            {peutFixerRemuneration && cout !== suggestion && !editCout && (
              <button type="button" onClick={() => ouvrirEditionCout(suggestion)} className="font-semibold text-brand-600 hover:underline">
                Reprendre ce montant
              </button>
            )}
          </div>
        )}

        {ecartContrat && (
          <div className="flex items-start gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Le contrat signé {contratActif.numero || ''} porte {euros(contratActif.montant_ht)} HT, la rémunération saisie {euros(cout)} :
              c&apos;est le contrat signé qui fait foi.
            </span>
          </div>
        )}

        {factures.length > 0 && (
          <div className="rounded-xl border border-surface-100">
            <div className="flex items-center gap-1.5 border-b border-surface-100 px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-surface-400">
              <ReceiptEuro className="h-3.5 w-3.5" /> Factures du formateur
            </div>
            <ul className="divide-y divide-surface-100">
              {factures.map((f) => {
                const st = STATUT_FACTURE[f.status || ''] || { label: f.status || '—', variant: 'default' as BadgeVariant }
                const autre = f.formateur_id && formateur?.id && f.formateur_id !== formateur.id
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="font-medium text-surface-800">{f.numero || f.reference_externe || 'Facture'}</span>
                    {autre && <span className="text-xs text-surface-500">{nomsFormateurs.get(f.formateur_id as string) || 'Autre formateur'}</span>}
                    <span className="flex-1" />
                    <span className="tabular-nums text-surface-700">{euros(f.montant_ht)} HT</span>
                    <Badge variant={st.variant}>{st.label}{f.status === 'payee' && f.date_paiement ? ` le ${jourCourt(f.date_paiement)}` : ''}</Badge>
                  </li>
                )
              })}
            </ul>
            {formateur?.id && peutVoirFiche && (
              <div className="border-t border-surface-100 px-3 py-2">
                <Link href={`/dashboard/formateurs/${formateur.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                  Valider ou consulter les factures sur la fiche du formateur
                </Link>
              </div>
            )}
          </div>
        )}

        {onVoirRentabilite && (
          <button type="button" onClick={onVoirRentabilite} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline">
            <TrendingUp className="h-3.5 w-3.5" /> Voir la rentabilité de la session
          </button>
        )}
      </div>

      {/* ── Contrat de prestation : aperçu, envoi, relance, historique des mails ── */}
      {formateur && (
        <SessionDocuments
          pieces="contrat"
          sessionId={session.id}
          hasClient={!!session.client_id}
          hasFormateur
          formateurId={formateur.id}
          formateurNom={nomDe(formateur) || null}
          formateurEmail={formateur.email || null}
          formationNom={formationNom}
          dates={dates}
          contrat={contratActif}
          docEmailLogs={docEmailLogs}
        />
      )}

      {/* ── Contrats précédents de la session (changement de formateur, renvoi) ── */}
      {autresContrats.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
            <History className="h-4 w-4 text-surface-400" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Contrats précédents</span>
          </div>
          <ul className="divide-y divide-surface-100">
            {autresContrats.map((c) => {
              const st = STATUT_CONTRAT[c.status || ''] || { label: c.status || '—', variant: 'default' as BadgeVariant }
              const date = c.signature_formateur_date || c.sent_at || c.created_at
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="font-medium text-surface-800">{nomDe(c.formateur) || 'Formateur'}</span>
                  <span className="text-xs text-surface-500">
                    {[c.numero, c.montant_ht != null ? `${euros(c.montant_ht)} HT` : null].filter(Boolean).join(' · ')}
                  </span>
                  <span className="flex-1" />
                  <Badge variant={st.variant}>{st.label}</Badge>
                  {date && (
                    <span className="text-xs text-surface-400 tabular-nums">
                      {c.signature_formateur_date ? 'signé le ' : c.sent_at ? 'envoyé le ' : 'créé le '}{jourCourt(date)}
                    </span>
                  )}
                  {c.formateur_id && (
                    <a href={`/api/pdf/contrat-formateur/${c.formateur_id}?contrat=${c.id}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs font-medium text-surface-700 hover:bg-surface-50">
                      <Download className="h-3 w-3" /> PDF
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {changerOuvert && (
        <ChangerFormateurModal
          session={session}
          actuel={formateur}
          contratsActifs={contrats.filter((c) => c.status !== 'annule')}
          formateurs={formateurs}
          nbJours={nbJours}
          peutFixerRemuneration={peutFixerRemuneration}
          onClose={() => setChangerOuvert(false)}
          onDone={() => { setChangerOuvert(false); router.refresh() }}
        />
      )}
    </div>
  )
}

/**
 * Choix du nouveau formateur : disponibilité sur les dates de la session,
 * rémunération, façon de lui confier la mission, et ce qui arrive au contrat
 * du formateur actuel, dit avant de confirmer.
 */
function ChangerFormateurModal({ session, actuel, contratsActifs, formateurs, nbJours, peutFixerRemuneration, onClose, onDone }: {
  session: any
  actuel: FormateurFiche | null
  contratsActifs: ContratLigne[]
  formateurs: FormateurRef[]
  nbJours: number
  peutFixerRemuneration: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [choix, setChoix] = useState('')
  const sessionPassee = ['terminee', 'annulee'].includes(session.status)
  const [mission, setMission] = useState<'proposer' | 'acceptee'>(sessionPassee ? 'acceptee' : 'proposer')
  const remunerationInitiale = session.cout_formateur != null ? String(session.cout_formateur) : ''
  const [remuneration, setRemuneration] = useState(remunerationInitiale)
  // Montant proposé d'après le tarif du formateur choisi : il suit le choix tant qu'on ne l'a pas saisi soi-même
  const [remunerationProposee, setRemunerationProposee] = useState(false)

  const choisi = formateurs.find((f) => f.id === choix) || null
  const tarifChoisi = choisi?.tarif_journalier != null ? Number(choisi.tarif_journalier) : null
  const suggestion = tarifChoisi && nbJours > 0 ? Math.round(tarifChoisi * nbJours * 100) / 100 : null
  const nomActuel = nomDe(actuel)
  const debut = String(session.date_debut || '').slice(0, 10)
  const fin = String(session.date_fin || session.date_debut || '').slice(0, 10)

  const options = formateurs
    .filter((f) => f.id !== actuel?.id)
    .map((f) => ({
      value: f.id,
      label: `${nomDe(f) || 'Formateur'}${f.tarif_journalier ? ` — ${Number(f.tarif_journalier).toLocaleString('fr-FR')} €/jour` : ''}`,
      preview: {
        title: nomDe(f),
        lines: [
          { label: 'Tarif journalier', value: f.tarif_journalier ? `${euros(f.tarif_journalier)} HT` : '' },
          { label: "Zone d'intervention", value: f.zone_intervention || '' },
          { label: 'Fiche', value: f.a_verifier ? 'Remplie par le formateur, à vérifier' : '' },
        ],
      },
    }))

  function choisir(id: string) {
    setChoix(id)
    // Rémunération encore à définir (ou proposée pour le formateur choisi juste
    // avant) : proposée d'après le tarif de sa fiche, sinon rendue à sa valeur de départ
    if (remuneration.trim() !== '' && !remunerationProposee) return
    const f = formateurs.find((x) => x.id === id)
    if (f?.tarif_journalier && nbJours > 0) {
      setRemuneration(String(Math.round(Number(f.tarif_journalier) * nbJours * 100) / 100))
      setRemunerationProposee(true)
    } else {
      setRemuneration(remunerationInitiale)
      setRemunerationProposee(false)
    }
  }

  function confirmer() {
    if (!choix) { toast('error', 'Choisissez un formateur'); return }
    let coutFormateur: number | null | undefined
    if (peutFixerRemuneration) {
      const brut = remuneration.trim().replace(',', '.')
      coutFormateur = brut === '' ? null : Number(brut)
      if (coutFormateur !== null && (!Number.isFinite(coutFormateur) || coutFormateur < 0)) { toast('error', 'Rémunération invalide'); return }
    }
    startTransition(async () => {
      const r = await changerFormateurSessionAction(session.id, choix, {
        mission, ...(peutFixerRemuneration ? { coutFormateur } : {}),
      })
      if (!r.success) { toast('error', r.error || 'Erreur'); return }
      const email = r.data?.email
      toast('success', mission === 'acceptee'
        ? 'Formateur changé : mission notée acceptée'
        : email ? `Formateur changé : proposition de mission envoyée à ${email}`
        : r.warning ? 'Formateur changé'
        : 'Formateur changé. Sa fiche n’a pas d’adresse e-mail : prévenez-le directement.')
      if (r.warning) toast('warning', r.warning)
      onDone()
    })
  }

  return (
    <Modal isOpen onClose={onClose} size="lg"
      title={actuel ? 'Changer de formateur' : 'Affecter un formateur'}
      description={debut ? `Session du ${jourCourt(debut)}${fin && fin !== debut ? ` au ${jourCourt(fin)}` : ''}` : undefined}>
      <div className="space-y-5">
        <div className="space-y-2">
          <SearchSelect
            id="nouveau_formateur"
            label={actuel ? 'Nouveau formateur' : 'Formateur'}
            options={options}
            value={choix}
            onChange={choisir}
            placeholder="Rechercher un formateur…"
          />
          {choix && debut && fin && (
            <FormateurDispoBadge formateurId={choix} dateDebut={debut} dateFin={fin} excludeSessionId={session.id} />
          )}
          {choisi?.a_verifier && (
            <div className="flex items-start gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Fiche remplie par le formateur lui-même : relisez-la avant de lui confier la mission.
            </div>
          )}
        </div>

        {peutFixerRemuneration && (
          <div>
            <label htmlFor="remuneration_nouveau" className="block text-sm font-medium text-surface-700 mb-1.5">Rémunération (€ HT)</label>
            <input id="remuneration_nouveau" type="number" min="0" step="0.01" inputMode="decimal"
              value={remuneration} onChange={(e) => { setRemuneration(e.target.value); setRemunerationProposee(false) }}
              placeholder={suggestion != null ? String(suggestion) : 'À définir'}
              className="input-base w-full sm:w-48" />
            {suggestion != null && (
              <p className="mt-1 text-xs text-surface-500">
                Tarif de sa fiche : {euros(tarifChoisi)} / jour × {nbJours} jour{nbJours > 1 ? 's' : ''} = {euros(suggestion)}
                {remuneration.trim() !== String(suggestion) && (
                  <> · <button type="button" onClick={() => { setRemuneration(String(suggestion)); setRemunerationProposee(true) }} className="font-semibold text-brand-600 hover:underline">Reprendre ce montant</button></>
                )}
              </p>
            )}
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-surface-700 mb-1.5">Mission</legend>
          {([
            { v: 'proposer', titre: 'Lui proposer la mission', texte: "Il reçoit un e-mail et l'accepte depuis son espace ; son contrat lui est envoyé à l'acceptation." },
            { v: 'acceptee', titre: 'Il a déjà donné son accord', texte: "Aucun e-mail ne part : la mission est notée acceptée et vous lui envoyez le contrat depuis cet onglet." },
          ] as const).map((o) => (
            <label key={o.v} className={cn(
              'flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
              mission === o.v ? 'border-brand-300 bg-brand-50/50' : 'border-surface-200 hover:bg-surface-50',
            )}>
              <input type="radio" name="mission" value={o.v} checked={mission === o.v} onChange={() => setMission(o.v)} className="mt-1 accent-brand-500" />
              <span>
                <span className="block text-sm font-medium text-surface-900">{o.titre}</span>
                <span className="block text-xs text-surface-500">{o.texte}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {actuel && (
          <div className="rounded-xl border border-surface-200 bg-surface-50/60 px-3 py-2.5 text-xs text-surface-600 space-y-1.5">
            <div className="font-semibold text-surface-700">Pour {nomActuel || 'le formateur actuel'}</div>
            {contratsActifs.length === 0 && <p>Aucun contrat en cours : rien à annuler.</p>}
            {contratsActifs.map((c) => (
              <p key={c.id}>
                {c.signature_formateur_date
                  ? <>Le contrat {c.numero || ''}, signé le {jourCourt(c.signature_formateur_date)}, sera annulé : il reste archivé, mais ne compte plus dans le coût de la session.</>
                  : <>Le contrat {c.numero || ''} sera annulé et son lien de signature désactivé.</>}
              </p>
            ))}
            <p>Il n&apos;est pas prévenu automatiquement.</p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={confirmer} isLoading={pending} disabled={!choix} icon={<UserCog className="h-4 w-4" />}>
            {actuel ? 'Changer de formateur' : 'Affecter ce formateur'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
