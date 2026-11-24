'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wallet, ChevronRight, Download, ExternalLink, Building2, CalendarCheck, Check, Loader2 } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { LigneCommissionSession } from '@/lib/franchise-data'
import { changerDateVersementAction } from '../session-commission-actions'

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))
/** Jour du paiement à Paris (AAAA-MM-JJ), identique au serveur et au navigateur */
const jourParis = (iso: string) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso))
const dateLongue = (jour: string) =>
  new Date(jour + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
const dateCourte = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Paris' }) : ''

interface Versement {
  /** AAAA-MM-JJ, ou 'aucune' pour un paiement sans date enregistrée */
  jour: string
  lignes: LigneCommissionSession[]
  total: number
  /** Sessions versées à 0 € (marge nulle) : absentes du relevé PDF */
  aZero: number
  etablissements: number
}

/**
 * Historique des commissions versées à une franchise, regroupées par jour de
 * versement, le plus récent d'abord, avec le relevé PDF de chaque versement.
 * La date d'un versement se corrige (paiement fait avant d'être noté).
 */
export function CommissionsPayees({ franchiseId, lignes, onAnnuler, occupe }: {
  franchiseId: string
  lignes: LigneCommissionSession[]
  /** Remet une commission versée « à venir » (paiement annulé) */
  onAnnuler?: (l: LigneCommissionSession) => void
  /** session_id en cours de traitement */
  occupe?: string | null
}) {
  const versements = useMemo<Versement[]>(() => {
    const parJour = new Map<string, LigneCommissionSession[]>()
    for (const l of lignes) {
      if (l.status !== 'payee') continue
      const jour = l.payee_at ? jourParis(l.payee_at) : 'aucune'
      if (!parJour.has(jour)) parJour.set(jour, [])
      parJour.get(jour)!.push(l)
    }
    return Array.from(parJour.entries())
      .map(([jour, ls]) => ({
        jour,
        lignes: ls.slice().sort((a, b) =>
          (a.client?.raison_sociale || '').localeCompare(b.client?.raison_sociale || '') ||
          String(a.session?.date_debut || '').localeCompare(String(b.session?.date_debut || ''))),
        total: ls.reduce((t, l) => t + (Number(l.commission_montant) || 0), 0),
        aZero: ls.filter((l) => !(Number(l.commission_montant) > 0)).length,
        etablissements: new Set(ls.map((l) => l.client?.id || 'sans')).size,
      }))
      // Le plus récent d'abord ; les paiements sans date à la fin
      .sort((a, b) => (a.jour === 'aucune' ? 1 : b.jour === 'aucune' ? -1 : b.jour.localeCompare(a.jour)))
  }, [lignes])

  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const basculer = (jour: string) => setOuverts((prev) => {
    const next = new Set(prev)
    if (next.has(jour)) next.delete(jour)
    else next.add(jour)
    return next
  })
  const [enEdition, setEnEdition] = useState<string | null>(null)

  const total = versements.reduce((t, v) => t + v.total, 0)
  const nbSessions = versements.reduce((t, v) => t + v.lignes.length, 0)

  return (
    <section id="commissions-payees" className="card overflow-hidden scroll-mt-24">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-success-50 text-success-700 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-heading font-semibold text-surface-900">
              Versées
              {nbSessions > 0 && <span className="ml-1.5 text-xs font-normal text-surface-500">{nbSessions} session{nbSessions > 1 ? 's' : ''}</span>}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              {versements.length
                ? `${versements.length} versement${versements.length > 1 ? 's' : ''}, du plus récent au plus ancien. Dépliez un versement pour voir ses sessions.`
                : 'Aucune commission versée pour le moment.'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-heading font-bold text-success-700 tabular-nums">{euro(total)}</div>
          <div className="text-[11px] text-surface-400">TTC</div>
        </div>
      </div>

      {versements.length > 0 && (
        <ul className="border-t border-surface-100 divide-y divide-surface-100">
          {versements.map((v) => {
            const ouvert = ouverts.has(v.jour)
            const releve = `/api/pdf/releve-commissions/${franchiseId}?etat=payee&versement=${v.jour}`
            return (
              <li key={v.jour}>
                <div className="flex items-center gap-2 pr-3 sm:pr-4">
                  <button
                    type="button"
                    onClick={() => basculer(v.jour)}
                    aria-expanded={ouvert}
                    className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-3 text-left hover:bg-surface-50/60 transition-colors"
                  >
                    <ChevronRight className={cn('h-4 w-4 text-surface-400 shrink-0 transition-transform', ouvert && 'rotate-90')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-surface-900">
                        {v.jour === 'aucune' ? 'Versées, date non enregistrée' : `Versé le ${dateLongue(v.jour)}`}
                      </div>
                      <div className="text-xs text-surface-500">
                        {v.lignes.length} session{v.lignes.length > 1 ? 's' : ''}
                        {/* Le relevé PDF ne reprend que les sessions avec une commission */}
                        {v.aZero > 0 && <>, dont {v.aZero} à 0 €</>}
                        {' · '}{v.etablissements} établissement{v.etablissements > 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-success-700 tabular-nums whitespace-nowrap">{euro(v.total)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnEdition(enEdition === v.jour ? null : v.jour)}
                    aria-label="Corriger la date du versement"
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-800"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Date</span>
                  </button>
                  <a
                    href={releve}
                    aria-label={`Relevé PDF du versement${v.jour === 'aucune' ? '' : ` du ${dateLongue(v.jour)}`}`}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Relevé</span>
                  </a>
                </div>

                {enEdition === v.jour && (
                  <DateVersement franchiseId={franchiseId} versement={v} onFermer={() => setEnEdition(null)} />
                )}

                {ouvert && (
                  <ul className="bg-surface-50/50 border-t border-surface-100 divide-y divide-surface-100">
                    {v.lignes.map((l) => {
                      const s = l.session
                      const titre = s?.formation?.intitule || s?.intitule || 'Session'
                      return (
                        <li key={l.id} className={cn('flex items-center gap-3 pl-11 pr-4 py-2.5', occupe === l.session_id && 'opacity-60')}>
                          <div className="min-w-0 flex-1">
                            <Link href={`/dashboard/sessions/${l.session_id}`}
                              className="text-sm font-medium text-surface-900 hover:text-brand-600 inline-flex items-center gap-1">
                              {s?.reference || titre}
                              <ExternalLink className="h-3 w-3 opacity-50" />
                            </Link>
                            <div className="text-xs text-surface-500 truncate">
                              <Building2 className="inline h-3 w-3 mr-1 -mt-0.5 text-surface-400" />
                              {l.client?.raison_sociale || 'Sans établissement'}
                              {' · '}{s?.reference ? `${titre} · ` : ''}{dateCourte(s?.date_debut)}
                              {s?.date_fin && s.date_fin !== s.date_debut ? ` → ${dateCourte(s.date_fin)}` : ''}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-surface-900 tabular-nums whitespace-nowrap">{euro(Number(l.commission_montant) || 0)}</span>
                          {onAnnuler && (
                            <button type="button" onClick={() => onAnnuler(l)}
                              className="text-[11px] font-medium text-surface-400 hover:text-surface-700 whitespace-nowrap">
                              Annuler le paiement
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Correction de la date d'un versement : toutes ses sessions passent au nouveau jour, sans mail. */
function DateVersement({ franchiseId, versement, onFermer }: { franchiseId: string; versement: Versement; onFermer: () => void }) {
  const router = useRouter()
  const aujourdhui = jourParis(new Date().toISOString())
  const [jour, setJour] = useState(versement.jour === 'aucune' ? aujourdhui : versement.jour)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    setEnCours(true)
    setErreur(null)
    const r = await changerDateVersementAction(franchiseId, versement.jour, jour)
    setEnCours(false)
    if (r.success) { onFermer(); router.refresh() }
    else setErreur(r.error || 'Enregistrement impossible')
  }

  return (
    <div className="border-t border-surface-100 bg-surface-50/60 px-4 py-3 sm:pl-11">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`jour-${versement.jour}`} className="block text-xs font-semibold text-surface-600 mb-1">Date réelle du paiement</label>
          <input id={`jour-${versement.jour}`} type="date" value={jour} max={aujourdhui} onChange={(e) => setJour(e.target.value)}
            className="input-base text-sm w-44" />
        </div>
        <button type="button" onClick={enregistrer} disabled={enCours || !jour || jour === versement.jour}
          className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50">
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Enregistrer
        </button>
        <button type="button" onClick={onFermer} disabled={enCours} className="px-3 py-2 rounded-lg text-sm text-surface-600 hover:bg-surface-100">
          Annuler
        </button>
      </div>
      <p className="mt-2 text-[11px] text-surface-500">
        Les {versement.lignes.length} sessions de ce versement prennent cette date. Aucun mail n&apos;est envoyé.
      </p>
      {erreur && <p className="mt-1 text-xs text-danger-600">{erreur}</p>}
    </div>
  )
}
