'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Banknote, Clock, CheckCircle2, XCircle, RefreshCw, Download, ExternalLink, AlertTriangle } from '@/components/ui/icons'
import { Button, Modal, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  LIBELLES_STATUT_COMMISSION, libelleLigne, totauxCommissions,
  type CommissionApporteurLigne, type StatutCommissionApporteur,
} from '@/lib/commission-apporteur'
import { syncCommissionsApporteurAction, updateCommissionApporteurStatusAction, payerCommissionsApporteurAction } from './actions'

const fmtEuro = (n: number | string | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

const BLOCS: { etat: StatutCommissionApporteur; titre: string; texte: string; Icone: typeof Banknote; teinte: string; couleur: string }[] = [
  {
    etat: 'validee', titre: 'À verser',
    texte: 'Formations terminées et encaissées : la commission est due à l’apporteur.',
    Icone: Banknote, teinte: 'bg-brand-50 text-brand-600', couleur: 'text-brand-600',
  },
  {
    etat: 'en_attente', titre: 'En attente d’encaissement',
    texte: 'Formations terminées dont les factures ne sont pas toutes réglées. La ligne passe « à verser » d’elle-même à l’encaissement, ou à la main.',
    Icone: Clock, teinte: 'bg-amber-50 text-amber-600', couleur: 'text-amber-600',
  },
  {
    etat: 'payee', titre: 'Versées',
    texte: 'Commissions réglées à l’apporteur.',
    Icone: CheckCircle2, teinte: 'bg-emerald-50 text-emerald-600', couleur: 'text-emerald-600',
  },
  {
    etat: 'annulee', titre: 'Annulées',
    texte: 'Lignes écartées à la main ; le recalcul ne les touche pas.',
    Icone: XCircle, teinte: 'bg-surface-100 text-surface-500', couleur: 'text-surface-500',
  },
]

const PASTILLE: Record<StatutCommissionApporteur, string> = {
  validee: 'bg-brand-50 text-brand-700',
  en_attente: 'bg-amber-50 text-amber-700',
  payee: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-surface-100 text-surface-500',
}

interface Props {
  apporteurId: string
  lignes: CommissionApporteurLigne[]
  peutGerer: boolean
  /** Sessions terminées sans montant connu (ni OPCO, ni prix, ni facture). */
  sansMontant: string[]
}

/**
 * Commissions d'un apporteur sur la fiche administrateur : lignes groupées
 * par état, validation, versement (unitaire ou groupé) et relevés PDF.
 */
export function ApporteurCommissions({ apporteurId, lignes, peutGerer, sansMontant }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, start] = useTransition()
  const [paiement, setPaiement] = useState<{ commissionId?: string; tout?: boolean; montant: number } | null>(null)
  const [reference, setReference] = useState('')
  const t = totauxCommissions(lignes)

  function agir(fn: () => Promise<{ success: boolean; error?: string; data?: any }>, ok?: string) {
    start(async () => {
      const r = await fn()
      if (r.success) { if (ok) toast('success', ok); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  function recalculer() {
    agir(async () => {
      const r = await syncCommissionsApporteurAction(apporteurId)
      if (r.success) {
        const d = (r.data || {}) as Record<string, number>
        toast('success', `${d.creees || 0} ligne${d.creees > 1 ? 's' : ''} créée${d.creees > 1 ? 's' : ''}, ${d.misesAJour || 0} mise${d.misesAJour > 1 ? 's' : ''} à jour, ${d.validees || 0} passée${d.validees > 1 ? 's' : ''} à verser`)
      }
      return r
    })
  }

  function confirmerPaiement() {
    const p = paiement
    if (!p) return
    setPaiement(null)
    const ref = reference.trim() || undefined
    setReference('')
    if (p.tout) agir(() => payerCommissionsApporteurAction(apporteurId, ref), 'Commissions marquées versées')
    else if (p.commissionId) agir(() => updateCommissionApporteurStatusAction(p.commissionId!, 'payee', ref), 'Commission marquée versée')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Commissions</span>
          <span className="text-xs text-surface-400 tabular-nums">· {fmtEuro(t.validee)} à verser · {fmtEuro(t.en_attente)} en attente · {fmtEuro(t.payee)} versées</span>
        </div>
        {peutGerer && (
          <div className="flex items-center gap-2">
            {t.nb.validee > 0 && (
              <Button size="sm" onClick={() => setPaiement({ tout: true, montant: t.validee })} disabled={pending} icon={<CheckCircle2 className="h-4 w-4" />}>
                Tout marquer versé ({fmtEuro(t.validee)})
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={recalculer} disabled={pending} icon={<RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />}>
              Recalculer
            </Button>
          </div>
        )}
      </div>

      {sansMontant.length > 0 && (
        <div className="card p-3 text-xs text-amber-800 bg-amber-50/60 border-amber-100 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{sansMontant.length} formation{sansMontant.length > 1 ? 's' : ''} terminée{sansMontant.length > 1 ? 's' : ''} sans montant connu</div>
            <div className="mt-0.5">Renseignez la prise en charge OPCO ou le prix HT sur la session pour que la commission apparaisse.</div>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">{sansMontant.slice(0, 6).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        </div>
      )}

      {lignes.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-12 px-8">
          <Banknote className="h-6 w-6 text-surface-400 mb-3" />
          <p className="text-sm text-surface-500">Aucune commission pour le moment.</p>
          <p className="text-xs text-surface-400 mt-1">Une ligne apparaît pour chaque session terminée chez un établissement rattaché à cet apporteur.</p>
        </div>
      )}

      {BLOCS.map((b) => {
        const l = lignes.filter((x) => x.status === b.etat)
        if (!l.length) return null
        const total = l.reduce((s, x) => s + Number(x.montant_commission || 0), 0)
        return (
          <div key={b.etat} className="card overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-4 pt-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', b.teinte)}><b.Icone className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <h3 className="text-sm font-heading font-semibold text-surface-900">{b.titre}</h3>
                  <p className="text-xs text-surface-400 mt-0.5">{l.length} formation{l.length > 1 ? 's' : ''} · {b.texte}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn('text-lg font-heading font-bold tabular-nums', b.couleur)}>{fmtEuro(total)}</div>
                {b.etat !== 'annulee' && (
                  <a href={`/api/pdf/releve-commissions-apporteur/${apporteurId}?etat=${b.etat}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-brand-600">
                    <Download className="h-3.5 w-3.5" /> Relevé PDF
                  </a>
                )}
              </div>
            </div>

            <div className="divide-y divide-surface-100 border-t border-surface-100 mt-3">
              {l.map((x) => {
                const { titre, sousTitre } = libelleLigne(x)
                const statut = x.status as StatutCommissionApporteur
                return (
                  <div key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-[200px]">
                      {x.session_id ? (
                        <Link href={`/dashboard/sessions/${x.session_id}`} className="text-sm font-medium text-surface-900 hover:text-brand-600 inline-flex items-center gap-1">
                          {titre} <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-surface-900">{titre}</div>
                      )}
                      <div className="text-xs text-surface-400 truncate max-w-[320px]">
                        {[sousTitre, fmtDate(x.date_session || x.session?.date_debut)].filter(Boolean).join(' · ')}
                        {x.status === 'payee' && x.date_paiement ? ` · versée le ${fmtDate(x.date_paiement)}${x.reference_paiement ? ` (${x.reference_paiement})` : ''}` : ''}
                      </div>
                    </div>
                    <div className="hidden sm:block text-right w-28">
                      <div className="text-sm tabular-nums text-surface-700">{fmtEuro(x.montant_base)}</div>
                      <div className="text-[10px] text-surface-400">{x.taux_applique != null ? `${Number(x.taux_applique).toLocaleString('fr-FR')} % de la base` : 'montant fixe'}</div>
                    </div>
                    <div className="text-right w-24">
                      <div className={cn('text-sm font-bold tabular-nums', b.couleur)}>{fmtEuro(x.montant_commission)}</div>
                    </div>
                    <span className={cn('inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold shrink-0', PASTILLE[statut] || PASTILLE.en_attente)}>
                      {LIBELLES_STATUT_COMMISSION[statut] || x.status}
                    </span>
                    {peutGerer && (
                      <div className="inline-flex items-center gap-1 shrink-0">
                        {statut === 'en_attente' && (
                          <>
                            <button disabled={pending} onClick={() => agir(() => updateCommissionApporteurStatusAction(x.id, 'validee'), 'Commission à verser')}
                              className="text-[11px] font-semibold px-2 py-1 rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100">Valider</button>
                            <button disabled={pending} onClick={() => agir(() => updateCommissionApporteurStatusAction(x.id, 'annulee'), 'Commission annulée')}
                              className="text-[11px] text-surface-400 hover:text-danger-600 px-1">Annuler</button>
                          </>
                        )}
                        {statut === 'validee' && (
                          <>
                            <button disabled={pending} onClick={() => setPaiement({ commissionId: x.id, montant: Number(x.montant_commission || 0) })}
                              className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Marquer versée</button>
                            <button disabled={pending} onClick={() => agir(() => updateCommissionApporteurStatusAction(x.id, 'en_attente'), 'Commission remise en attente')}
                              className="text-[11px] text-surface-400 hover:text-surface-700 px-1">Remettre en attente</button>
                          </>
                        )}
                        {statut === 'payee' && (
                          <button disabled={pending} onClick={() => agir(() => updateCommissionApporteurStatusAction(x.id, 'validee'), 'Versement annulé')}
                            className="text-[11px] text-surface-400 hover:text-surface-700">Annuler le versement</button>
                        )}
                        {statut === 'annulee' && (
                          <button disabled={pending} onClick={() => agir(() => updateCommissionApporteurStatusAction(x.id, 'en_attente'), 'Commission rétablie')}
                            className="text-[11px] text-surface-400 hover:text-surface-700">Rétablir</button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <Modal isOpen={!!paiement} onClose={() => setPaiement(null)} size="sm" title="Marquer comme versée"
        description={paiement ? `${fmtEuro(paiement.montant)} ${paiement.tout ? 'de commissions validées passent' : 'passe'} en « versée ». L’apporteur en est informé.` : undefined}>
        <div className="space-y-3">
          <Input id="reference_paiement" label="Référence du virement (facultatif)" placeholder="Ex. VIR-2026-09-22" value={reference} onChange={(e) => setReference(e.target.value)} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setPaiement(null)}>Annuler</Button>
            <Button type="button" onClick={confirmerPaiement} icon={<CheckCircle2 className="h-4 w-4" />}>Confirmer le versement</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
