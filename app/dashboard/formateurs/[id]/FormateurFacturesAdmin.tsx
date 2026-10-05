'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ReceiptEuro, Download, CheckCircle2, Clock, XCircle, BadgeEuro, Calendar, Building2, MapPin } from '@/components/ui/icons'
import { useToast } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { dureeFr, type DetailPrestation } from '@/lib/facture-formateur-detail'
import { updateFactureFormateurStatusAction } from '../actions'

const STATUT: Record<string, { label: string; cls: string; Icon: any }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-surface-100 text-surface-600', Icon: ReceiptEuro },
  envoyee: { label: 'À valider', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  validee: { label: 'Validée', cls: 'bg-sky-50 text-sky-700', Icon: CheckCircle2 },
  payee: { label: 'Payée', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  rejetee: { label: 'Rejetée', cls: 'bg-danger-50 text-danger-700', Icon: XCircle },
}
const fmt = (n: any) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function FormateurFacturesAdmin({ factures, fileUrls, details = {} }: {
  factures: any[]
  fileUrls: Record<string, string>
  /** Détail de la prestation, par identifiant de facture. */
  details?: Record<string, DetailPrestation>
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, start] = useTransition()

  function act(id: string, status: 'validee' | 'payee' | 'rejetee') {
    let motif: string | undefined
    if (status === 'rejetee') {
      const m = prompt('Motif du rejet ?')
      if (m === null) return
      motif = m
    }
    start(async () => {
      const r = await updateFactureFormateurStatusAction(id, status, motif)
      if (r.success) { toast('success', 'Facture mise à jour'); router.refresh() }
      else toast('error', r.error || 'Erreur')
    })
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <BadgeEuro className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Factures de prestation ({factures.length})</span>
      </div>
      {factures.length === 0 ? (
        <div className="text-center py-10 text-sm text-surface-400">Aucune facture envoyée par ce formateur</div>
      ) : (
        <div className="divide-y divide-surface-100">
          {factures.map((f) => {
            const st = STATUT[f.status] || STATUT.envoyee
            const d = details[f.id]
            return (
              <div key={f.id} className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-900 truncate">{f.objet || f.numero || 'Facture'}{f.reference_externe ? <span className="text-surface-400 font-normal"> · {f.reference_externe}</span> : null}</div>
                    <div className="text-xs text-surface-500 mt-0.5">{f.numero} · {formatDate(f.date_emission || f.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="text-sm font-bold text-surface-900 shrink-0">{fmt(f.montant_ttc)}</div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}><st.Icon className="h-3 w-3" /> {st.label}</span>
                  <a href={(f.fichier_url && fileUrls[f.fichier_url]) ? fileUrls[f.fichier_url] : `/api/pdf/facture-formateur/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-50 text-surface-500 text-[11px] font-medium hover:bg-surface-100 shrink-0"><Download className="h-3 w-3" /> PDF</a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {f.status === 'envoyee' && (
                      <>
                        <button onClick={() => act(f.id, 'validee')} disabled={pending} className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-[11px] font-medium hover:bg-sky-100 disabled:opacity-50">Valider</button>
                        <button onClick={() => act(f.id, 'rejetee')} disabled={pending} className="px-2.5 py-1 rounded-lg bg-danger-50 text-danger-600 text-[11px] font-medium hover:bg-danger-100 disabled:opacity-50">Rejeter</button>
                      </>
                    )}
                    {f.status === 'validee' && (
                      <button onClick={() => act(f.id, 'payee')} disabled={pending} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 disabled:opacity-50">Marquer payée</button>
                    )}
                  </div>
                </div>
                {d ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500">
                    {d.periode && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{d.periode}{dureeFr(d) ? ` · ${dureeFr(d)}` : ''}</span>}
                    {d.client && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{d.client}{d.clientVille ? `, ${d.clientVille}` : ''}</span>}
                    {d.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.lieu}</span>}
                    {d.reference && <span className="font-mono text-[11px] text-surface-400">{d.reference}</span>}
                  </div>
                ) : (
                  <div className="mt-1.5 text-xs text-amber-700">Aucune session rattachée : à rattacher depuis Finances, Factures formateurs.</div>
                )}
                {f.status === 'rejetee' && f.motif_rejet && <div className="mt-1.5 text-xs text-danger-600">Motif : {f.motif_rejet}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
