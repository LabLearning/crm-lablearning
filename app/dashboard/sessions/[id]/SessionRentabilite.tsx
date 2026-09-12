'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, ReceiptEuro, Presentation, Receipt, Store, Handshake, Wallet, Scale,
  AlertTriangle, AlertCircle, Info, Lock, Clock, BadgeCheck, ExternalLink, RefreshCw, ChevronDown,
  type LucideIcon,
} from '@/components/ui/icons'
import { Badge, Button, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { BadgeVariant } from '@/lib/types'
import {
  euro, pourcent, QUALITE_LABELS, QUALITE_MARGE_LABELS, SEUIL_MARGE_FAIBLE, STATUT_LABELS,
  type Alerte, type LigneRentab, type Rentabilite, type StatutMarge, type VueRentabiliteSession,
} from '@/lib/rentabilite'
import { recalcSessionCommissionAction } from '@/app/dashboard/franchises/session-commission-actions'
import { SessionFrais } from './SessionFrais'

const STATUT_BADGE: Record<StatutMarge, BadgeVariant> = {
  rentable: 'success',
  marge_faible: 'warning',
  deficitaire: 'danger',
  incomplete: 'default',
  sans_objet: 'default',
}

const ALERTE_STYLE: Record<Alerte['niveau'], { classe: string; icone: LucideIcon }> = {
  critique: { classe: 'bg-danger-50 text-danger-700', icone: AlertTriangle },
  attention: { classe: 'bg-warning-50 text-warning-700', icone: AlertTriangle },
  info: { classe: 'bg-info-50 text-info-600', icone: Info },
}

const QUALITE_STYLE: Record<string, string> = {
  facture: 'bg-success-50 text-success-700',
  contractualise: 'bg-brand-50 text-brand-600',
  saisi: 'bg-surface-100 text-surface-600',
  prevu: 'bg-info-50 text-info-600',
  estime: 'bg-warning-50 text-warning-700',
  inconnu: 'bg-danger-50 text-danger-700',
  fige: 'bg-surface-100 text-surface-700',
  a_venir: 'bg-info-50 text-info-600',
}

const NOTE_MONTANTS = 'Recettes HT (organisme exonéré de TVA). Coûts : montants réellement payés, TVA comprise.'

const couleurMarge = (statut: StatutMarge) =>
  statut === 'rentable' ? 'text-success-700' : statut === 'marge_faible' ? 'text-warning-700' : statut === 'deficitaire' ? 'text-danger-600' : 'text-surface-900'

const estExterne = (href: string) => href.startsWith('/api/') || /^https?:\/\//.test(href)

/**
 * Bloc Rentabilité de l'onglet Facturation : CA, coûts, marge et encaissement,
 * calculés en direct. Une session d'intervention POEI n'affiche que ses coûts.
 */
export function SessionRentabilite({ vue, sessionId }: { vue: VueRentabiliteSession | { erreur: string }; sessionId: string }) {
  if ('erreur' in vue) {
    return (
      <div className="card p-4 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
        <p className="text-sm text-surface-600">{vue.erreur}</p>
      </div>
    )
  }
  if (vue.role === 'intervention') return <VueIntervention vue={vue} sessionId={sessionId} />
  return <VueUnite vue={vue} sessionId={sessionId} />
}

// ─── Parcours complet ou session classique ──────────────────────────────────

function VueUnite({ vue, sessionId }: { vue: VueRentabiliteSession; sessionId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [recalcul, setRecalcul] = useState(false)
  const r = vue.rentabilite
  const titre = r.type === 'poei' ? `Rentabilité du parcours ${vue.parcours?.numeros.join(' + ') || 'POEI'}` : 'Rentabilité'
  // Le message de migration des frais s'affiche dans la section Frais annexes
  const alertes = r.alertes.filter((a) => a.code !== 'A21')

  const recettes = r.lignes.filter((l) => l.famille === 'recette')
  const formateurs = r.lignes.filter((l) => l.famille === 'formateur')
  const commissions = r.lignes.filter((l) => l.famille === 'commission_franchise' || l.famille === 'commission_apporteur')
  const heritees = r.lignes.filter((l) => l.famille === 'frais' && !l.fraisId)
  const frais = Object.values(vue.fraisParSession).flat()
  const commissionsTotal = r.couts.commissionFranchise == null || r.couts.commissionApporteur == null
    ? null : r.couts.commissionFranchise + r.couts.commissionApporteur
  const ecartCommission = r.alertes.some((a) => a.code === 'A14')

  async function recalculer() {
    setRecalcul(true)
    const res = await recalcSessionCommissionAction(sessionId)
    setRecalcul(false)
    if (res.success) { toast('success', 'Commission recalculée'); router.refresh() }
    else toast('error', res.error || 'Recalcul impossible')
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <EnTete titre={titre} r={r} />
        <Tuiles r={r} />
        <ListeAlertes alertes={alertes} />
      </section>

      <section className="card p-5 space-y-6">
        <SectionDetail
          titre="Chiffre d'affaires"
          icone={ReceiptEuro}
          total={r.recette.prevu == null ? 'Non renseigné' : euro(r.recette.prevu)}
          totalInconnu={r.recette.prevu == null}
        >
          <LignesRecette lignes={recettes} />
        </SectionDetail>

        <SectionDetail
          titre={r.type === 'poei' ? 'Formateurs du parcours' : 'Formateur'}
          icone={Presentation}
          total={r.couts.formateurInconnu ? `${euro(r.couts.formateur)} + à compléter` : euro(r.couts.formateur)}
          totalInconnu={r.couts.formateurInconnu}
        >
          {formateurs.map((l) => <LigneDetail key={l.cle} l={l} sessionCourante={sessionId} />)}
        </SectionDetail>

        <SectionDetail titre="Frais annexes" icone={Receipt} total={euro(r.couts.frais)}>
          <SessionFrais
            sessionId={sessionId}
            frais={frais}
            lignesHeritees={heritees}
            sessions={vue.sessionsFrais}
            formateurs={vue.formateursFrais}
            disponible={vue.fraisDisponibles}
          />
        </SectionDetail>

        <SectionDetail
          titre="Commissions"
          icone={Store}
          total={commissionsTotal == null ? 'Non renseigné' : euro(commissionsTotal)}
          totalInconnu={commissionsTotal == null}
        >
          {commissions.map((l) => <LigneDetail key={l.cle} l={l} icone={l.famille === 'commission_apporteur' ? Handshake : Store} />)}
          {ecartCommission && vue.peutRecalculerCommission && r.type === 'session' && (
            <div className="pt-2">
              <Button type="button" variant="secondary" size="sm" isLoading={recalcul} onClick={recalculer}
                icon={<RefreshCw className="h-3.5 w-3.5" />}>
                Recalculer la commission
              </Button>
            </div>
          )}
        </SectionDetail>

        <div className="border-t border-surface-200 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-heading font-semibold text-surface-900">Marge</span>
            {r.marge != null ? (
              <span className={cn('text-base font-heading font-bold tabular-nums', couleurMarge(r.statut))}>
                {euro(r.marge)}
                <span className="ml-2 text-sm font-semibold">{pourcent(r.taux)}</span>
              </span>
            ) : (
              <span className="text-sm font-heading font-semibold text-surface-500">
                {r.statut === 'sans_objet' ? 'Sans objet' : 'À compléter'}
              </span>
            )}
          </div>
          {r.marge == null && r.statut !== 'sans_objet' && (
            <p className="mt-1 text-xs text-surface-500">
              Marge partielle, hors éléments manquants : <span className="tabular-nums font-medium text-surface-700">{euro(r.margePartielle)}</span>
            </p>
          )}
          <p className="mt-3 text-2xs text-surface-400">{NOTE_MONTANTS}</p>
        </div>
      </section>
    </div>
  )
}

// ─── Session d'intervention d'un parcours POEI ──────────────────────────────

function VueIntervention({ vue, sessionId }: { vue: VueRentabiliteSession; sessionId: string }) {
  const r = vue.rentabilite
  const ancres = vue.ancres || []
  const formateurs = r.lignes.filter((l) => l.famille === 'formateur' && l.ancre && ancres.includes(l.ancre))
  const inconnu = formateurs.some((l) => l.montant == null)
  const coutFormateur = formateurs.reduce((a, l) => a + (l.montant || 0), 0)
  const frais = vue.fraisParSession[sessionId] || []
  const heritees = r.lignes.filter((l) => l.famille === 'frais' && !l.fraisId && l.sessionId === sessionId)
  const totalFrais = frais.reduce((a, f) => a + f.montant, 0) + heritees.reduce((a, l) => a + (l.montant || 0), 0)
  const numero = vue.parcours?.numeros.join(' + ') || 'POEI'
  const moi = vue.sessionsFrais.filter((s) => s.id === sessionId)

  return (
    <section className="card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-heading font-semibold text-surface-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-500" />
            Coûts de l&apos;intervention
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">
            Cette session est une intervention du parcours {numero} : la recette est portée par le parcours.
          </p>
        </div>
        {vue.parcours && (
          <a href={vue.parcours.porteuseHref} className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0">
            <TrendingUp className="h-3.5 w-3.5" />
            Voir la rentabilité du parcours
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tuile icone={Presentation} label="Coût formateur"
          valeur={inconnu && coutFormateur === 0 ? 'Non renseigné' : euro(coutFormateur)}
          valeurClasse={inconnu ? 'text-warning-700' : undefined}
          sous={inconnu ? 'Une rémunération reste à renseigner' : undefined} />
        <Tuile icone={Receipt} label="Frais annexes" valeur={euro(totalFrais)} />
      </div>

      {formateurs.length > 0 && (
        <SectionDetail titre="Formateur" icone={Presentation}>
          {formateurs.map((l) => <LigneDetail key={l.cle} l={l} sessionCourante={sessionId} />)}
        </SectionDetail>
      )}

      <SectionDetail titre="Frais annexes" icone={Receipt}>
        <SessionFrais
          sessionId={sessionId}
          frais={frais}
          lignesHeritees={heritees}
          sessions={moi}
          formateurs={vue.formateursFrais}
          disponible={vue.fraisDisponibles}
        />
      </SectionDetail>

      <p className="text-2xs text-surface-400">{NOTE_MONTANTS}</p>
    </section>
  )
}

// ─── Morceaux ───────────────────────────────────────────────────────────────

function EnTete({ titre, r }: { titre: string; r: Rentabilite }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-heading font-semibold text-surface-900 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-500" />
          {titre}
        </h2>
        <p className="text-xs text-surface-500 mt-0.5">Calcul en direct à partir des factures, contrats, frais et commissions.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={STATUT_BADGE[r.statut]}>
          {r.statut === 'incomplete' && <AlertCircle className="h-3 w-3" />}
          {r.statut === 'rentable' && <BadgeCheck className="h-3 w-3" />}
          {STATUT_LABELS[r.statut]}
        </Badge>
        {r.statut !== 'sans_objet' && (
          <span className="text-xs text-surface-500">{QUALITE_MARGE_LABELS[r.qualiteMarge]}</span>
        )}
      </div>
    </div>
  )
}

function Tuile({ icone: Icone, label, valeur, valeurClasse, sous, children }: {
  icone: LucideIcon
  label: string
  valeur: React.ReactNode
  valeurClasse?: string
  sous?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-surface-50 p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500">
        <Icone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('mt-1.5 text-lg font-heading font-semibold tabular-nums text-surface-900 leading-tight', valeurClasse)}>{valeur}</div>
      {children}
      {sous && <div className="mt-1.5 text-xs text-surface-500 leading-snug">{sous}</div>}
    </div>
  )
}

function Tuiles({ r }: { r: Rentabilite }) {
  const R = r.recette
  const C = r.couts
  const commissions = (C.commissionFranchise || 0) + (C.commissionApporteur || 0)
  const commissionInconnue = C.commissionFranchise == null || C.commissionApporteur == null
  // La marge sur le seul facturé n'a de sens qu'une fois une partie facturée
  const surFacture = R.aFacturer > 0.005 && R.facture > 0 && r.marge != null ? R.facture - C.total : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      <Tuile
        icone={ReceiptEuro}
        label="Chiffre d'affaires"
        valeur={R.prevu == null ? 'Non renseigné' : euro(R.prevu)}
        valeurClasse={R.prevu == null ? 'text-warning-700' : undefined}
        sous={R.prevu == null
          ? (R.indicationCatalogue != null ? `Catalogue : environ ${euro(R.indicationCatalogue)}, non retenu` : 'Aucun prix, prise en charge ni facture')
          : <>Facturé <span className="tabular-nums">{euro(R.facture)}</span> · reste à facturer <span className="tabular-nums">{euro(R.aFacturer)}</span></>}
      />
      <Tuile
        icone={Scale}
        label="Coûts"
        valeur={euro(C.total)}
        sous={C.formateurInconnu
          ? 'Coût formateur non renseigné'
          : <>Formateur <span className="tabular-nums">{euro(C.formateur)}</span> · frais <span className="tabular-nums">{euro(C.frais)}</span> · commissions <span className="tabular-nums">{commissionInconnue ? 'à compléter' : euro(commissions)}</span></>}
      />
      <Tuile
        icone={TrendingUp}
        label="Marge"
        valeur={r.marge != null
          ? <span className="inline-flex items-center gap-1.5">{r.statut === 'deficitaire' && <AlertTriangle className="h-4 w-4" />}{euro(r.marge)}</span>
          : r.statut === 'sans_objet' ? 'Sans objet' : 'À compléter'}
        valeurClasse={r.marge != null ? couleurMarge(r.statut) : 'text-surface-500'}
        sous={r.marge != null
          ? <><span className="tabular-nums font-medium">{pourcent(r.taux)}</span> du CA{surFacture != null && <> · sur le facturé seul : <span className="tabular-nums">{euro(surFacture)}</span></>}</>
          : r.statut === 'sans_objet'
            ? 'Session sans inscrit ni montant'
            : <>
                Marge partielle : <span className="tabular-nums">{euro(r.margePartielle)}</span>
                {r.manques.length > 0 && <span className="block mt-0.5 text-warning-700">Manque : {r.manques.join(', ')}</span>}
              </>}
      >
        {r.marge != null && r.taux != null && <JaugeTaux taux={r.taux} statut={r.statut} />}
      </Tuile>
      <Tuile
        icone={Wallet}
        label="Encaissé"
        valeur={euro(R.encaisse)}
        sous={(R.resteDu > 0.005 || R.encaissementNonSuivi > 0.005)
          ? <>
              {R.resteDu > 0.005 && <>Reste dû <span className="tabular-nums">{euro(R.resteDu)}</span></>}
              {R.resteDu > 0.005 && R.encaissementNonSuivi > 0.005 && ' · '}
              {R.encaissementNonSuivi > 0.005 && <>Dendreo : <span className="tabular-nums">{euro(R.encaissementNonSuivi)}</span> non suivis</>}
            </>
          : R.facture > 0 ? 'Tout le facturé est encaissé' : 'Rien de facturé pour le moment'}
      />
    </div>
  )
}

/** Taux de marge sur une jauge, repère au seuil de marge faible. */
function JaugeTaux({ taux, statut }: { taux: number; statut: StatutMarge }) {
  const largeur = Math.max(0, Math.min(1, taux)) * 100
  const couleur = statut === 'rentable' ? 'bg-success-500' : statut === 'marge_faible' ? 'bg-warning-500' : 'bg-danger-500'
  return (
    <div className="relative mt-2 h-1.5 rounded-full bg-surface-200" aria-hidden="true">
      <div className={cn('absolute inset-y-0 left-0 rounded-full', couleur)} style={{ width: `${largeur}%` }} />
      <div className="absolute -top-0.5 -bottom-0.5 w-px bg-surface-400" style={{ left: `${SEUIL_MARGE_FAIBLE * 100}%` }} />
    </div>
  )
}

function ListeAlertes({ alertes }: { alertes: Alerte[] }) {
  const [tout, setTout] = useState(false)
  if (!alertes.length) return null
  const LIMITE = 4
  const visibles = tout ? alertes : alertes.slice(0, LIMITE)
  return (
    <ul className="mt-4 space-y-1.5">
      {visibles.map((a) => {
        const { classe, icone: Icone } = ALERTE_STYLE[a.niveau]
        return (
          <li key={a.code + a.message} className={cn('rounded-lg px-3 py-2 text-xs flex gap-2', classe)}>
            <Icone className="h-4 w-4 shrink-0 mt-px" />
            <span>{a.message}</span>
          </li>
        )
      })}
      {alertes.length > LIMITE && (
        <li>
          <button type="button" onClick={() => setTout((v) => !v)} className="text-xs font-medium text-surface-500 hover:text-surface-700">
            {tout ? 'Afficher moins' : `Afficher ${alertes.length - LIMITE} autre${alertes.length - LIMITE > 1 ? 's' : ''} point${alertes.length - LIMITE > 1 ? 's' : ''}`}
          </button>
        </li>
      )}
    </ul>
  )
}

function SectionDetail({ titre, icone: Icone, total, totalInconnu, children }: {
  titre: string
  icone: LucideIcon
  total?: string
  totalInconnu?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-surface-100">
        <div className="section-label flex items-center gap-1.5">
          <Icone className="h-3.5 w-3.5" />
          {titre}
        </div>
        {total && (
          <div className={cn('text-xs font-semibold tabular-nums', totalInconnu ? 'text-warning-700' : 'text-surface-700')}>{total}</div>
        )}
      </div>
      {children}
    </div>
  )
}

/** Recettes : montant attendu, puis le compté, puis les pièces montrées hors total (repliées si nombreuses). */
function LignesRecette({ lignes }: { lignes: LigneRentab[] }) {
  const [deplie, setDeplie] = useState(false)
  const base = lignes.filter((l) => l.cle === 'base')
  const comptees = lignes.filter((l) => l.cle !== 'base' && !l.horsTotal)
  const horsTotal = lignes.filter((l) => l.cle !== 'base' && l.horsTotal)
  const replier = horsTotal.length > 3
  const totalHors = horsTotal.reduce((a, l) => a + (l.montant || 0), 0)
  const brouillons = horsTotal.filter((l) => l.qualiteLabel === 'Brouillon').length
  return (
    <div>
      {[...base, ...comptees].map((l) => <LigneDetail key={l.cle} l={l} />)}
      {replier && !deplie ? (
        <button type="button" onClick={() => setDeplie(true)}
          className="w-full flex items-center justify-between gap-3 py-2 text-left border-b border-surface-100 last:border-0 group">
          <span className="text-sm text-surface-600 group-hover:text-surface-800 inline-flex items-center gap-1.5">
            <ChevronDown className="h-3.5 w-3.5" />
            {brouillons === horsTotal.length ? `${horsTotal.length} factures en brouillon` : `${horsTotal.length} factures non comptées`}
          </span>
          <span className="text-sm tabular-nums text-surface-400">{euro(totalHors)}</span>
        </button>
      ) : (
        horsTotal.map((l) => <LigneDetail key={l.cle} l={l} />)
      )}
    </div>
  )
}

function PuceQualite({ l }: { l: LigneRentab }) {
  const Icone = l.qualite === 'fige' ? Lock : l.qualite === 'a_venir' ? Clock : null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none', QUALITE_STYLE[l.qualite] || QUALITE_STYLE.saisi)}>
      {Icone && <Icone className="h-3 w-3" />}
      {l.qualiteLabel || QUALITE_LABELS[l.qualite]}
    </span>
  )
}

function LigneDetail({ l, icone: Icone, sessionCourante }: { l: LigneRentab; icone?: LucideIcon; sessionCourante?: string }) {
  // Pas de lien vers la fiche qu'on est en train de lire
  const utile = (x: { href: string }) => !sessionCourante || !x.href.startsWith(`/dashboard/sessions/${sessionCourante}?tab=facturation`)
  const lienPrincipal = l.lien && utile(l.lien) ? l.lien : undefined
  // Un montant manquant affiche aussi son lien en clair : c'est l'action attendue
  const secondaires = [
    ...(l.montant == null && !l.info && lienPrincipal ? [lienPrincipal] : []),
    ...(l.liens || []).filter((x) => x.href !== lienPrincipal?.href && utile(x)),
  ]
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-surface-100 last:border-0">
      <div className="min-w-0 flex items-start gap-2">
        {Icone && !l.info && <Icone className="h-4 w-4 text-surface-400 mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <p className={cn('text-sm', l.info ? 'text-surface-500' : 'text-surface-800', l.horsTotal && 'text-surface-600')}>{l.libelle}</p>
          {l.detail && <p className="text-xs text-surface-500 mt-0.5 break-words">{l.detail}</p>}
          {(!l.info || secondaires.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {!l.info && <PuceQualite l={l} />}
              {secondaires.map((x) => (
                <a key={x.href} href={x.href} target={estExterne(x.href) ? '_blank' : undefined} rel={estExterne(x.href) ? 'noopener noreferrer' : undefined}
                  className="text-xs font-medium text-brand-600 underline decoration-surface-300 underline-offset-2 hover:decoration-brand-500">
                  {x.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!l.info && (
          <span className={cn('text-sm tabular-nums whitespace-nowrap',
            l.montant == null ? 'text-warning-700 font-medium' : l.horsTotal ? 'text-surface-400' : 'font-medium text-surface-900')}>
            {l.montant == null ? 'Non renseigné' : euro(l.montant)}
          </span>
        )}
        {lienPrincipal && (
          <a href={lienPrincipal.href} target={estExterne(lienPrincipal.href) ? '_blank' : undefined}
            rel={estExterne(lienPrincipal.href) ? 'noopener noreferrer' : undefined}
            aria-label={lienPrincipal.label}
            className="p-1 rounded-md text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
