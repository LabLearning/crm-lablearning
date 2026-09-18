import Link from 'next/link'
import { ShieldCheck, FileWarning, AlertTriangle, ExternalLink } from '@/components/ui/icons'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

const MENTION_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  SATISFAISANT: 'success',
  'A AMELIORER': 'warning',
  INSUFFISANT: 'danger',
}

const scoreCouleur = (n: number) => (n >= 80 ? '#16a34a' : n >= 60 ? '#d97706' : '#dc2626')

/**
 * Audits hygiène et DUERP réalisés sur les établissements de ce client,
 * remontés d'AuditHygiène Pro. Un audit qui sort « insuffisant » est un besoin
 * de formation identifié (indicateur Qualiopi 4).
 */
export function ClientAuditsHygiene({
  audits, duerps, actionsEnRetard,
}: {
  audits: any[]
  duerps: any[]
  actionsEnRetard: number
}) {
  if (audits.length === 0 && duerps.length === 0) return null

  const dernier = audits[0]
  const evolution =
    audits.length > 1 && dernier?.score_global != null && audits[audits.length - 1]?.score_global != null
      ? Number(dernier.score_global) - Number(audits[audits.length - 1].score_global)
      : null

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Audits hygiène &amp; DUERP
          </span>
        </div>
        <Link href="/dashboard/audits-hygiene" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 min-h-10 -my-3 px-2 -mr-2 shrink-0">
          Tout voir <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {(dernier || actionsEnRetard > 0) && (
        <div className="px-4 py-3 bg-surface-50/60 border-b border-surface-100 flex flex-wrap items-center gap-4 text-sm">
          {dernier && (
            <div className="flex items-center gap-2">
              <span className="text-surface-500 text-xs">Dernier score</span>
              <span className="text-lg font-heading font-bold" style={{ color: scoreCouleur(Number(dernier.score_global) || 0) }}>
                {dernier.score_global ?? '—'}
              </span>
              {evolution !== null && evolution !== 0 && (
                <span className={evolution > 0 ? 'text-xs text-success-600' : 'text-xs text-danger-600'}>
                  {evolution > 0 ? '+' : ''}{Math.round(evolution)} depuis le premier audit
                </span>
              )}
            </div>
          )}
          {actionsEnRetard > 0 && (
            <div className="flex items-center gap-1.5 text-danger-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">{actionsEnRetard} action(s) DUERP en retard</span>
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-surface-100">
        {audits.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-heading font-bold shrink-0"
              style={{ backgroundColor: `${scoreCouleur(Number(a.score_global) || 0)}1a`, color: scoreCouleur(Number(a.score_global) || 0) }}>
              {a.score_global ?? '—'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-surface-800 truncate">
                {a.type_audit || 'Audit hygiène'}
                {a._etabNom ? ` — ${a._etabNom}` : ''}
              </div>
              <div className="text-xs text-surface-500">
                {a.date_audit ? formatDate(a.date_audit) : '—'}
                {a.formateur_nom ? ` · ${a.formateur_nom}` : ''}
                {a.nb_non_conformes ? ` · ${a.nb_non_conformes} non-conformités` : ''}
              </div>
            </div>
            {a.mention && <Badge variant={MENTION_VARIANT[a.mention] || 'default'}>{a.mention}</Badge>}
          </div>
        ))}

        {duerps.map((d) => (
          <div key={d.id} className="px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
              <FileWarning className="h-4 w-4 text-surface-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-surface-800 truncate">
                DUERP{d.num_document ? ` ${d.num_document}` : ''}
                {d._etabNom ? ` — ${d._etabNom}` : ''}
              </div>
              <div className="text-xs text-surface-500">
                {d.date_evaluation ? formatDate(d.date_evaluation) : '—'}
                {` · ${d.nb_unites} unités · ${d.nb_risques} risques · ${d.nb_actions} actions`}
              </div>
            </div>
            {d.risques_critiques > 0 && <Badge variant="danger">{d.risques_critiques} critiques</Badge>}
          </div>
        ))}
      </div>
    </div>
  )
}
