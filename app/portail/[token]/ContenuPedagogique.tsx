import { FileText, Download, BookOpen, Wrench, ListChecks, CheckCircle2, Clock } from 'lucide-react'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/document'
import type { SessionSupport, PositionnementRow } from '@/lib/session-contenu'
import { cn, formatDate } from '@/lib/utils'

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

/**
 * Liste de supports téléchargeables depuis un portail.
 * Les supports reçus sont déjà filtrés côté serveur selon le profil : ce
 * composant n'applique aucune règle de visibilité, il ne fait qu'afficher.
 */
export function SupportsList({
  supports, token, title = 'Supports de formation',
}: {
  supports: SessionSupport[]
  token: string
  title?: string
}) {
  if (supports.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
        <FileText className="h-3.5 w-3.5" />
        {title} ({supports.length})
      </div>
      <div className="space-y-2">
        {supports.map((d) => (
          <a
            key={d.id}
            href={`/api/documents/${d.id}/download?token=${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-surface-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-surface-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 truncate">{d.nom}</div>
              <div className="text-xs text-surface-500 truncate">
                {(DOCUMENT_TYPE_LABELS as any)[d.type] || d.type}
                {d.file_size ? ` · ${fmtSize(d.file_size)}` : ''}
              </div>
            </div>
            <Download className="h-4 w-4 text-surface-400 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  )
}

/** Bloc complet destiné au formateur : déroulé, matériel, supports, positionnement */
export function ContenuPedagogiqueFormateur({
  token, deroule, materiel, supports, positionnement,
}: {
  token: string
  deroule: string | null
  materiel: string | null
  supports: SessionSupport[]
  positionnement: PositionnementRow[]
}) {
  const faits = positionnement.filter((p) => p.fait).length
  const rienASignaler = !deroule && !materiel && supports.length === 0 && positionnement.length === 0
  if (rienASignaler) return null

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-brand-500" />
        <h2 className="text-sm font-heading font-semibold text-surface-900">Contenu pédagogique</h2>
      </div>

      {deroule && (
        <div>
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Déroulé</div>
          <p className="text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">{deroule}</p>
        </div>
      )}

      {materiel && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
            <Wrench className="h-3.5 w-3.5" /> Matériel nécessaire
          </div>
          <p className="text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">{materiel}</p>
        </div>
      )}

      <SupportsList supports={supports} token={token} title="Mes supports" />

      {positionnement.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider">
              <ListChecks className="h-3.5 w-3.5" /> Questionnaire de positionnement
            </div>
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
              faits === positionnement.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {faits}/{positionnement.length}
            </span>
          </div>
          <div className="rounded-xl border border-surface-200 divide-y divide-surface-100">
            {positionnement.map((p) => (
              <div key={p.apprenant_id} className="flex items-center gap-3 px-3 py-2.5">
                {p.fait
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                <span className="flex-1 min-w-0 text-sm text-surface-800 truncate">{p.prenom} {p.nom}</span>
                {p.fait ? (
                  <span className="text-xs text-surface-500 shrink-0">
                    {p.score != null ? `${Math.round(p.score)}%` : 'Complété'}
                    {p.completed_at ? ` · ${formatDate(p.completed_at, { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 shrink-0">Non passé</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
