'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Wallet, ChevronRight, Download, ExternalLink, Building2 } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { LigneCommissionSession } from '@/lib/franchise-data'

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
  /** Sessions payées à 0 € (marge nulle) : absentes du relevé PDF */
  aZero: number
  etablissements: number
}

/**
 * Historique des commissions payées à une franchise, regroupées par jour de
 * versement (un « Tout payer » ou des « Payer » le même jour), le plus récent
 * d'abord, avec le relevé PDF de chaque versement.
 */
export function CommissionsPayees({ franchiseId, lignes }: { franchiseId: string; lignes: LigneCommissionSession[] }) {
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

  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(versements[0] ? [versements[0].jour] : []))
  const basculer = (jour: string) => setOuverts((prev) => {
    const next = new Set(prev)
    if (next.has(jour)) next.delete(jour)
    else next.add(jour)
    return next
  })

  const total = versements.reduce((t, v) => t + v.total, 0)
  const nbSessions = versements.reduce((t, v) => t + v.lignes.length, 0)

  return (
    <section id="commissions-payees" className="card overflow-hidden scroll-mt-24">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-success-50 text-success-700 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-heading font-semibold text-surface-900">Commissions payées</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              {versements.length
                ? `${versements.length} versement${versements.length > 1 ? 's' : ''} · ${nbSessions} session${nbSessions > 1 ? 's' : ''}`
                : 'Aucune commission payée pour le moment'}
            </p>
          </div>
        </div>
        {versements.length > 0 && (
          <div className="text-right shrink-0">
            <div className="text-[11px] text-surface-500">Total versé TTC</div>
            <div className="text-lg font-heading font-bold text-success-700 tabular-nums">{euro(total)}</div>
          </div>
        )}
      </div>

      {versements.length === 0 ? (
        <p className="border-t border-surface-100 px-4 py-3 text-xs text-surface-500">
          Une commission apparaît ici dès que vous la passez en « Payée » (bouton « Payer » d&apos;une session, ou « Tout payer »).
        </p>
      ) : (
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
                        {v.jour === 'aucune' ? 'Payées, date non enregistrée' : `Versé le ${dateLongue(v.jour)}`}
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
                  <a
                    href={releve}
                    aria-label={`Relevé PDF du versement${v.jour === 'aucune' ? '' : ` du ${dateLongue(v.jour)}`}`}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Relevé</span>
                  </a>
                </div>

                {ouvert && (
                  <ul className="bg-surface-50/50 border-t border-surface-100 divide-y divide-surface-100">
                    {v.lignes.map((l) => {
                      const s = l.session
                      const titre = s?.formation?.intitule || s?.intitule || 'Session'
                      return (
                        <li key={l.id} className="flex items-center gap-3 pl-11 pr-4 py-2.5">
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
