'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Settings2, Check, Loader2, RefreshCw, Clock, X, ExternalLink, Banknote,
  ChevronRight, AlertTriangle, Download, Building2,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { commissionTypeLabel } from '@/lib/commission'
import { updateFranchiseCommissionConfigAction } from '../actions'
import {
  recalcSessionCommissionAction,
  updateSessionCommissionStatusAction,
  syncFranchiseCommissionsAction,
  noterVersementAction,
} from '../session-commission-actions'
import type { LigneCommissionSession } from '@/lib/franchise-data'
import { CommissionsPayees } from './CommissionsPayees'

type CommissionType = 'budget_debloque' | 'budget_net'
type CommStatus = 'a_venir' | 'validee' | 'payee' | 'annulee'

interface Props {
  franchiseId: string
  commissionType: CommissionType
  taux: number
  lignes: LigneCommissionSession[]
}

const euro = (n: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))
const euroRond = (n: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))
const dateCourte = (d?: string | null) =>
  d ? new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Paris' }) : ''
/** Jour à Paris (AAAA-MM-JJ) d'un instant enregistré */
const jourParis = (iso: string) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso))
const aujourdhui = () => jourParis(new Date().toISOString())
const montant = (l: LigneCommissionSession) => Number(l.commission_montant) || 0

/** Lignes d'un état, regroupées par établissement (le plus gros d'abord), sessions par date. */
function parEtablissement(lignes: LigneCommissionSession[]) {
  const map = new Map<string, { cle: string; clientId: string | null; nom: string; lignes: LigneCommissionSession[]; total: number }>()
  for (const l of lignes) {
    const cle = l.client?.id || 'sans'
    if (!map.has(cle)) map.set(cle, { cle, clientId: l.client?.id || null, nom: l.client?.raison_sociale || 'Sans établissement', lignes: [], total: 0 })
    const g = map.get(cle)!
    g.lignes.push(l)
    g.total += montant(l)
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, lignes: g.lignes.slice().sort((a, b) => String(a.session?.date_debut || '').localeCompare(String(b.session?.date_debut || ''))) }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom))
}

/**
 * Onglet Commissions d'une franchise : le réglage, puis chaque commission à
 * son étape (à verser, à venir, versée, annulée), avec l'action qui la fait
 * avancer. Une session n'apparaît qu'une fois.
 */
export default function FranchiseDetailClient({ franchiseId, commissionType, taux, lignes }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [occupe, setOccupe] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  // Panneau « Noter un versement » : les sessions cochées au départ
  const [versement, setVersement] = useState<string[] | null>(null)

  const parEtat = useMemo(() => {
    const r: Record<CommStatus, LigneCommissionSession[]> = { a_venir: [], validee: [], payee: [], annulee: [] }
    for (const l of lignes) r[((l.status || 'a_venir') as CommStatus)]?.push(l)
    return r
  }, [lignes])
  const total = (ls: LigneCommissionSession[]) => ls.reduce((t, l) => t + montant(l), 0)
  const sansMontant = parEtat.a_venir.filter((l) => !(Number(l.base_montant) > 0)).length

  const agir = (cle: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setOccupe(cle)
    startTransition(async () => {
      const r = await fn()
      setOccupe(null)
      if (!r.success) alert(r.error || 'Erreur')
      else router.refresh()
    })
  }
  const changerStatut = (l: LigneCommissionSession, statut: CommStatus) =>
    agir(l.session_id, () => updateSessionCommissionStatusAction(l.session_id, statut))

  const recalculerTout = () => {
    setSyncing(true)
    startTransition(async () => {
      const r = await syncFranchiseCommissionsAction(franchiseId)
      setSyncing(false)
      if (!r.success) alert(r.error || 'Erreur')
      else router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <ConfigCommission franchiseId={franchiseId} commissionType={commissionType} taux={taux} />

      {/* À verser : la commission est due, c'est l'action du moment */}
      <SectionEtat
        icone={Banknote}
        ton="brand"
        titre="À verser"
        texte="Dossiers terminés et encaissés : la commission est due à la franchise. Notez le versement une fois le paiement fait."
        nb={parEtat.validee.length}
        total={total(parEtat.validee)}
        vide="Aucune commission à verser pour le moment."
        actions={parEtat.validee.length > 0 && versement == null && (
          <>
            <button type="button" onClick={() => setVersement(parEtat.validee.map((l) => l.session_id))}
              className="btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs">
              <Check className="h-3.5 w-3.5" /> Noter un versement
            </button>
            <a href={`/api/pdf/releve-commissions/${franchiseId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
              <Download className="h-3.5 w-3.5" /> Relevé PDF
            </a>
          </>
        )}
      >
        {versement != null ? (
          <PanneauVersement
            franchiseId={franchiseId}
            lignes={parEtat.validee}
            initial={versement}
            onFermer={() => setVersement(null)}
          />
        ) : (
          <Groupes lignes={parEtat.validee} rendu={(l) => (
            <LigneCommission key={l.id} l={l} occupe={occupe === l.session_id}>
              <BoutonLigne onClick={() => setVersement([l.session_id])} ton="success">Payer</BoutonLigne>
              <BoutonLigne onClick={() => changerStatut(l, 'a_venir')} ton="discret" aide="La commission redevient « à venir » et se recalcule (coût, déplacement du formateur…)">
                Annuler la validation
              </BoutonLigne>
            </LigneCommission>
          )} />
        )}
      </SectionEtat>

      {/* À venir : calculée, pas encore due */}
      <SectionEtat
        icone={Clock}
        titre="À venir"
        texte="Formations délivrées ou programmées dont le financeur n'a pas encore réglé. Validez la commission dès l'encaissement."
        nb={parEtat.a_venir.length}
        total={total(parEtat.a_venir)}
        vide="Aucune commission à venir."
        avertissement={sansMontant > 0 ? `${sansMontant} session${sansMontant > 1 ? 's' : ''} sans montant renseigné : commission à 0 € tant que la prise en charge ou le prix manque.` : undefined}
        actions={
          <button type="button" onClick={recalculerTout} disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Recalculer depuis les sessions
          </button>
        }
      >
        <Groupes lignes={parEtat.a_venir} rendu={(l) => (
          <LigneCommission key={l.id} l={l} occupe={occupe === l.session_id}>
            <BoutonLigne onClick={() => changerStatut(l, 'validee')} ton="brand">Valider</BoutonLigne>
            <button type="button" onClick={() => agir(l.session_id, () => recalcSessionCommissionAction(l.session_id))}
              aria-label="Recalculer la commission de cette session"
              className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-100">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </LigneCommission>
        )} />
      </SectionEtat>

      {/* Versées : l'historique, versement par versement */}
      <CommissionsPayees
        franchiseId={franchiseId}
        lignes={lignes}
        occupe={occupe}
        onAnnuler={(l) => { if (confirm('Annuler ce paiement ? La commission redevient « à venir » et se recalcule.')) changerStatut(l, 'a_venir') }}
      />

      {parEtat.annulee.length > 0 && <Annulees lignes={parEtat.annulee} />}
    </div>
  )
}

// ─── Noter un versement ─────────────────────────────────────────────────────

/**
 * Les commissions payées, le jour du paiement (aujourd'hui ou plus tôt) et le
 * mail à la franchise, au choix. Raccourcis : les commissions validées le même
 * jour forment souvent un relevé, payé d'un bloc.
 */
function PanneauVersement({ franchiseId, lignes, initial, onFermer }: {
  franchiseId: string
  lignes: LigneCommissionSession[]
  initial: string[]
  onFermer: () => void
}) {
  const router = useRouter()
  const [choisies, setChoisies] = useState<Set<string>>(new Set(initial))
  const [jour, setJour] = useState(aujourdhui())
  const [prevenir, setPrevenir] = useState(true)
  const [prevenirTouche, setPrevenirTouche] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Commissions validées le même jour : un relevé, souvent payé d'un bloc
  const parValidation = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const l of lignes) {
      const j = l.validee_at ? jourParis(l.validee_at) : 'inconnu'
      if (!m.has(j)) m.set(j, [])
      m.get(j)!.push(l.session_id)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [lignes])

  const groupes = useMemo(() => parEtablissement(lignes), [lignes])
  const totalChoisi = lignes.filter((l) => choisies.has(l.session_id)).reduce((t, l) => t + montant(l), 0)
  const basculer = (id: string) => setChoisies((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const changerJour = (j: string) => {
    setJour(j)
    // Un paiement passé est une régularisation : pas de mail, sauf choix contraire
    if (!prevenirTouche) setPrevenir(j === aujourdhui())
  }

  async function enregistrer() {
    setEnCours(true)
    setErreur(null)
    const r = await noterVersementAction(franchiseId, { sessionIds: Array.from(choisies), jour, prevenir })
    setEnCours(false)
    if (r.success) { onFermer(); router.refresh() }
    else setErreur(r.error || 'Enregistrement impossible')
  }

  return (
    <div className="border-t border-surface-100 bg-surface-50/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-surface-600 font-medium">Sélection rapide :</span>
        {parValidation.length > 1 && parValidation.map(([j, ids]) => (
          <button key={j} type="button" onClick={() => setChoisies(new Set(ids))}
            className="rounded-full border border-surface-200 bg-white px-2.5 py-1 font-medium text-surface-700 hover:border-brand-300 hover:text-brand-700">
            {j === 'inconnu' ? 'Validées sans date' : `Validées le ${dateCourte(j)}`} ({ids.length})
          </button>
        ))}
        <button type="button" onClick={() => setChoisies(new Set(lignes.map((l) => l.session_id)))}
          className="rounded-full border border-surface-200 bg-white px-2.5 py-1 font-medium text-surface-700 hover:border-brand-300 hover:text-brand-700">
          Tout ({lignes.length})
        </button>
        <button type="button" onClick={() => setChoisies(new Set())} className="px-1.5 py-1 font-medium text-surface-500 hover:text-surface-800">
          Aucune
        </button>
      </div>

      <div className="rounded-xl border border-surface-200 bg-white divide-y divide-surface-100">
        {groupes.map((g) => (
          <div key={g.cle}>
            <div className="px-3 py-1.5 text-[11px] font-semibold text-surface-500 bg-surface-50/80">{g.nom}</div>
            {g.lignes.map((l) => (
              <label key={l.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-50">
                <input type="checkbox" checked={choisies.has(l.session_id)} onChange={() => basculer(l.session_id)}
                  className="h-4 w-4 rounded border-surface-300 accent-[#205040]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-surface-800 truncate">{l.session?.reference || l.session?.formation?.intitule || l.session?.intitule || 'Session'}</span>
                  <span className="block text-[11px] text-surface-500 truncate">
                    {l.session?.reference ? `${l.session?.formation?.intitule || l.session?.intitule || ''} · ` : ''}
                    {l.validee_at ? `validée le ${dateCourte(jourParis(l.validee_at))}` : 'validée'}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums text-surface-900 whitespace-nowrap">{euro(montant(l))}</span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <label htmlFor="jour-versement" className="block text-xs font-semibold text-surface-600 mb-1">Payé le</label>
          <input id="jour-versement" type="date" value={jour} max={aujourdhui()} onChange={(e) => changerJour(e.target.value)}
            className="input-base text-sm w-44" />
        </div>
        <label className="flex items-start gap-2 text-xs text-surface-700 cursor-pointer max-w-sm pb-1">
          <input type="checkbox" checked={prevenir} onChange={(e) => { setPrevenir(e.target.checked); setPrevenirTouche(true) }}
            className="mt-0.5 h-4 w-4 rounded border-surface-300 accent-[#205040]" />
          <span>
            Prévenir la franchise par mail
            <span className="block text-[11px] text-surface-500">« Versement de commissions », avec le montant et la date, à ses comptes actifs.</span>
          </span>
        </label>
      </div>

      {erreur && <p className="text-xs text-danger-600">{erreur}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 pt-3">
        <div className="text-sm text-surface-600">
          {choisies.size} commission{choisies.size > 1 ? 's' : ''} · <span className="font-semibold tabular-nums text-surface-900">{euro(totalChoisi)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onFermer} disabled={enCours} className="px-3 py-2 rounded-lg text-sm text-surface-600 hover:bg-surface-100">
            Annuler
          </button>
          <button type="button" onClick={enregistrer} disabled={enCours || choisies.size === 0 || !jour}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer le versement
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Réglage de la commission ───────────────────────────────────────────────

function ConfigCommission({ franchiseId, commissionType, taux }: { franchiseId: string; commissionType: CommissionType; taux: number }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [edition, setEdition] = useState(false)
  const [type, setType] = useState<CommissionType>(commissionType)
  const [tauxVal, setTauxVal] = useState(String(taux))
  const [saving, setSaving] = useState(false)

  const enregistrer = () => {
    setSaving(true)
    startTransition(async () => {
      const r = await updateFranchiseCommissionConfigAction(franchiseId, type, parseFloat(tauxVal) || 0)
      setSaving(false)
      if (r.success) { setEdition(false); router.refresh() }
      else alert(r.error || 'Erreur')
    })
  }
  const changerType = (t: CommissionType) => {
    setType(t)
    if (t === 'budget_net' && (tauxVal === '10' || tauxVal === '')) setTauxVal('40')
    if (t === 'budget_debloque' && (tauxVal === '40' || tauxVal === '')) setTauxVal('10')
  }

  return (
    <div className="card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-start gap-2 min-w-0 text-sm">
          <Settings2 className="h-4 w-4 text-surface-400 shrink-0 mt-0.5" />
          <span className="min-w-0">
            <span className="font-medium text-surface-900">Commission : </span>
            <span className="text-surface-600">{commissionTypeLabel(commissionType, taux)}</span>
          </span>
        </div>
        {!edition && (
          <button type="button" onClick={() => setEdition(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Modifier
          </button>
        )}
      </div>
      {edition && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => changerType('budget_debloque')}
              className={cn('text-left p-3 rounded-xl border transition-all', type === 'budget_debloque' ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200' : 'border-surface-200 hover:border-surface-300')}>
              <div className="text-sm font-semibold text-surface-900">Budget débloqué</div>
              <div className="text-xs text-surface-500 mt-0.5">% × prise en charge OPCO de la session (à défaut prix HT)</div>
            </button>
            <button type="button" onClick={() => changerType('budget_net')}
              className={cn('text-left p-3 rounded-xl border transition-all', type === 'budget_net' ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200' : 'border-surface-200 hover:border-surface-300')}>
              <div className="text-sm font-semibold text-surface-900">Budget net</div>
              <div className="text-xs text-surface-500 mt-0.5">% × (prise en charge − coût formateur et frais)</div>
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <label htmlFor="taux-commission" className="text-xs font-semibold text-surface-600">Taux (%)</label>
              <input id="taux-commission" type="number" step="0.5" value={tauxVal} onChange={(e) => setTauxVal(e.target.value)} className="input-base w-full mt-1 text-sm" />
            </div>
            <button type="button" onClick={enregistrer} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer
            </button>
            <button type="button" onClick={() => { setEdition(false); setType(commissionType); setTauxVal(String(taux)) }}
              className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-600 hover:bg-surface-50">
              Annuler
            </button>
          </div>
          <p className="text-[11px] text-surface-500">
            La modification recalcule toutes les commissions « à venir » de cette franchise. Les commissions validées ou versées restent figées.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Morceaux ───────────────────────────────────────────────────────────────

function SectionEtat({ icone: Icone, ton, titre, texte, nb, total, vide, avertissement, actions, children }: {
  icone: React.ElementType
  ton?: 'brand'
  titre: string
  texte: string
  nb: number
  total: number
  vide: string
  avertissement?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', ton === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-500')}>
            <Icone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-heading font-semibold text-surface-900">
              {titre}
              {nb > 0 && <span className="ml-1.5 text-xs font-normal text-surface-500">{nb} session{nb > 1 ? 's' : ''}</span>}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5 max-w-2xl">{texte}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-lg font-heading font-bold tabular-nums', ton === 'brand' && nb > 0 ? 'text-brand-600' : 'text-surface-700')}>{euro(total)}</div>
          <div className="text-[11px] text-surface-400">TTC</div>
        </div>
        {actions && <div className="basis-full flex flex-wrap items-center gap-2 sm:pl-12">{actions}</div>}
        {avertissement && (
          <p className="basis-full sm:pl-12 flex items-start gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" /> {avertissement}
          </p>
        )}
      </div>
      {nb === 0 ? (
        <p className="border-t border-surface-100 px-4 py-3 text-xs text-surface-500">{vide}</p>
      ) : children}
    </section>
  )
}

/**
 * Sessions d'un état sous le nom de leur établissement, avec son sous-total.
 * Chaque établissement se déplie d'un clic sur sa flèche ; replié, il signale
 * encore ce qui demande une action (montant ou coût à renseigner, écart).
 */
function Groupes({ lignes, rendu }: { lignes: LigneCommissionSession[]; rendu: (l: LigneCommissionSession) => React.ReactNode }) {
  const groupes = useMemo(() => parEtablissement(lignes), [lignes])
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const toutOuvert = groupes.length > 0 && groupes.every((g) => ouverts.has(g.cle))
  const basculer = (cle: string) => setOuverts((prev) => {
    const next = new Set(prev)
    if (next.has(cle)) next.delete(cle)
    else next.add(cle)
    return next
  })

  return (
    <div className="border-t border-surface-100">
      {groupes.length > 1 && (
        <div className="flex justify-end px-4 py-1.5 border-b border-surface-100">
          <button type="button" onClick={() => setOuverts(toutOuvert ? new Set() : new Set(groupes.map((g) => g.cle)))}
            className="text-[11px] font-medium text-surface-500 hover:text-surface-800">
            {toutOuvert ? 'Tout replier' : 'Tout déplier'}
          </button>
        </div>
      )}
      {groupes.map((g) => {
        const ouvert = ouverts.has(g.cle)
        const aCompleter = g.lignes.filter((l) => l.status === 'a_venir' && (
          !(Number(l.base_montant) > 0) ||
          (l.commission_type === 'budget_net' && !(Number(l.cout_formateur) > 0) && l.cout_source !== 'fige')
        )).length
        const ecarts = g.lignes.filter((l) => l.ecart_fige && l.status === 'validee').length
        return (
          <div key={g.cle} className="border-b border-surface-100 last:border-0">
            <div className={cn('flex items-center gap-1 pr-3', ouvert ? 'bg-surface-50/70' : 'hover:bg-surface-50/60')}>
              <button type="button" onClick={() => basculer(g.cle)} aria-expanded={ouvert}
                className="flex-1 min-w-0 flex items-center gap-2 pl-4 py-2.5 text-left">
                <ChevronRight className={cn('h-4 w-4 text-surface-400 shrink-0 transition-transform', ouvert && 'rotate-90')} />
                <Building2 className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                <span className="text-sm font-medium text-surface-900 truncate">{g.nom}</span>
                <span className="text-[11px] text-surface-400 shrink-0">{g.lignes.length} dossier{g.lignes.length > 1 ? 's' : ''}</span>
                {aCompleter > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning-700 shrink-0">
                    <AlertTriangle className="h-3 w-3" /> {aCompleter} à compléter
                  </span>
                )}
                {ecarts > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning-700 shrink-0">
                    <AlertTriangle className="h-3 w-3" /> coûts modifiés
                  </span>
                )}
                <span className="ml-auto text-sm font-semibold text-surface-900 tabular-nums shrink-0 pl-3">{euro(g.total)}</span>
              </button>
              {g.clientId && (
                <Link href={`/dashboard/clients/${g.clientId}`} aria-label={`Fiche ${g.nom}`}
                  className="p-1.5 rounded-md text-surface-400 hover:text-brand-600 hover:bg-brand-50 shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            {ouvert && <div className="divide-y divide-surface-100 border-t border-surface-100">{g.lignes.map(rendu)}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** Libellé court de l'origine du coût formateur d'une ligne. */
const SOURCE_COUT: Record<string, string> = {
  contrat: 'contrat formateur',
  facture: 'facture du formateur',
  session: 'saisi sur la session',
  manuel: 'tarif saisi ici autrefois',
  fiche: 'fiche formateur × jours, estimation',
  parcours: 'formateurs du parcours',
  intervention: 'formateurs du parcours',
  fige: 'figé à la validation',
}

const SOURCE_BASE: Record<string, string> = {
  opco: 'prise en charge OPCO', poei: 'montant du parcours', factures: 'facturé', prix_ht: 'prix HT',
}

/** Une session : ce qu'elle rapporte, ce qu'elle coûte, sa commission et ses actions. */
function LigneCommission({ l, occupe, children }: { l: LigneCommissionSession; occupe: boolean; children?: React.ReactNode }) {
  const s = l.session
  const titre = s?.formation?.intitule || s?.intitule || 'Session'
  const base = Number(l.base_montant) || 0
  const cout = Number(l.cout_formateur) || 0
  const frais = Number(l.frais_annexes) || 0
  const net = l.commission_type === 'budget_net'
  const cs = (l.status || 'a_venir') as CommStatus
  return (
    <div className={cn('px-4 py-3', occupe && 'opacity-60')}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <Link href={`/dashboard/sessions/${l.session_id}`} className="text-sm font-medium text-surface-900 hover:text-brand-600 inline-flex items-center gap-1">
            {s?.reference || titre}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
          <div className="text-xs text-surface-500 line-clamp-2">
            {s?.reference ? `${titre} · ` : ''}{dateCourte(s?.date_debut)}{s?.date_fin && s.date_fin !== s.date_debut ? ` → ${dateCourte(s.date_fin)}` : ''}
          </div>
        </div>

        {/* Budget, puis coût déduit en budget net */}
        <div className="text-right w-28">
          {base > 0 ? (
            <>
              <div className="text-sm tabular-nums text-surface-700">{euroRond(base)}</div>
              <div className="text-[10px] text-surface-400">{SOURCE_BASE[l.base_source] || 'budget'}</div>
            </>
          ) : cs !== 'annulee' ? (
            <Link href={`/dashboard/sessions/${l.session_id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning-700 hover:underline">
              <AlertTriangle className="h-3 w-3" /> montant à renseigner
            </Link>
          ) : <span className="text-[11px] text-surface-400">sans montant</span>}
        </div>
        {net && (
          <div className="text-right w-32">
            {cout > 0 ? (
              <>
                <div className="text-sm tabular-nums text-surface-600">− {euroRond(cout + frais)}</div>
                <div className="text-[10px] leading-tight text-surface-400">
                  {SOURCE_COUT[l.cout_source || ''] || 'coût formateur'}{frais > 0 ? `, dont ${euroRond(frais)} de frais` : ''}
                </div>
              </>
            ) : l.cout_source !== 'fige' && cs === 'a_venir' ? (
              <Link href={`/dashboard/sessions/${l.session_id}?tab=formateur`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning-700 hover:underline">
                <AlertTriangle className="h-3 w-3" /> coût à renseigner
              </Link>
            ) : <span className="text-[11px] text-surface-400">coût non renseigné</span>}
          </div>
        )}
        <div className="text-right w-28">
          <div className="text-sm font-semibold text-surface-900 tabular-nums">{euro(montant(l))}</div>
          {l.commission_taux != null && (
            <div className="text-[10px] text-surface-400">{Number(l.commission_taux).toLocaleString('fr-FR')} % · {net ? 'net' : 'débloqué'}</div>
          )}
        </div>
        {children && <div className="flex items-center gap-1 shrink-0 self-center">{children}</div>}
      </div>

      {/* Ligne figée dont les coûts ont changé depuis (déplacement saisi après coup…) */}
      {l.ecart_fige && (cs === 'validee' || cs === 'payee') && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 min-w-[220px]">
            Coûts modifiés depuis la {cs === 'payee' ? 'validation et le paiement' : 'validation'} : formateur {euroRond(l.ecart_fige.cout)}
            {l.ecart_fige.frais > 0 ? `, déplacement ${euroRond(l.ecart_fige.frais)}` : ''}. Recalculée, la commission serait de {euro(l.ecart_fige.commission)} au lieu de {euro(montant(l))}.
            {cs === 'payee' ? ' Elle est déjà versée : elle reste figée.' : ' Annulez la validation pour la recalculer.'}
          </span>
        </div>
      )}
    </div>
  )
}

function BoutonLigne({ onClick, ton, aide, children }: { onClick: () => void; ton: 'brand' | 'success' | 'discret'; aide?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={aide}
      className={cn(
        'text-[11px] font-semibold px-2 py-1 rounded-md whitespace-nowrap',
        ton === 'brand' && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        ton === 'success' && 'bg-success-50 text-success-700 hover:bg-success-100',
        ton === 'discret' && 'font-medium text-surface-500 hover:text-surface-800',
      )}>
      {children}
    </button>
  )
}

function Annulees({ lignes }: { lignes: LigneCommissionSession[] }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-50/60">
        <ChevronRight className={cn('h-4 w-4 text-surface-400 shrink-0 transition-transform', ouvert && 'rotate-90')} />
        <X className="h-4 w-4 text-surface-400 shrink-0" />
        <span className="text-sm font-medium text-surface-700">Annulées</span>
        <span className="text-xs text-surface-500">{lignes.length} session{lignes.length > 1 ? 's' : ''}, hors commission</span>
      </button>
      {ouvert && <Groupes lignes={lignes} rendu={(l) => <LigneCommission key={l.id} l={l} occupe={false} />} />}
    </section>
  )
}
