import { FileSignature, Download, PenLine, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export interface ContratLigne {
  id: string
  numero: string | null
  intitule: string
  dateMission: string | null
  montantHt: number | null
  signeLe: string | null
  /** Lien de signature, quand le contrat est encore à signer */
  signUrl: string | null
}

/**
 * Contrats de prestation du formateur connecté.
 * Une fois signé, le contrat reste consultable et téléchargeable —
 * le lien de signature, lui, est à usage unique et expire.
 */
export function MesContratsSection({ contrats, formateurId }: { contrats: ContratLigne[]; formateurId: string }) {
  if (contrats.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-brand-500" />
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Mes contrats de prestation ({contrats.length})
        </span>
      </div>

      <div className="divide-y divide-surface-100">
        {contrats.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 truncate">{c.intitule}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-surface-500">
                {c.numero && <span className="font-mono text-surface-400">{c.numero}</span>}
                {c.dateMission && <span>{formatDate(c.dateMission, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                {c.montantHt != null && Number(c.montantHt) > 0 && (
                  <span className="font-medium text-surface-700">
                    {Number(c.montantHt).toLocaleString('fr-FR')} EUR HT
                  </span>
                )}
                {c.signeLe ? (
                  <span className="text-emerald-600 font-medium">
                    Signé le {formatDate(c.signeLe, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                    <Clock className="h-3 w-3" /> À signer
                  </span>
                )}
              </div>
            </div>

            {c.signeLe ? (
              <a
                href={`/api/pdf/contrat-formateur/${formateurId}?contrat=${c.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 transition-colors shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> Télécharger
              </a>
            ) : c.signUrl ? (
              <a
                href={c.signUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-surface-900 hover:bg-surface-800 transition-colors shrink-0"
              >
                <PenLine className="h-3.5 w-3.5" /> Signer
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
