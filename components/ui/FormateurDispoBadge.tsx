'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, Calendar, Building2 } from 'lucide-react'

interface DispoConflict {
  source: 'session' | 'google'
  date_debut: string
  date_fin: string
  title: string
  reference?: string
}

interface DispoResult {
  is_available: boolean
  conflicts: DispoConflict[]
  google_calendar_connected: boolean
}

interface FormateurDispoBadgeProps {
  formateurId: string
  dateDebut: string  // YYYY-MM-DD
  dateFin: string    // YYYY-MM-DD
  excludeSessionId?: string
}

export function FormateurDispoBadge({ formateurId, dateDebut, dateFin, excludeSessionId }: FormateurDispoBadgeProps) {
  const [data, setData] = useState<DispoResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!formateurId || !dateDebut || !dateFin) { setData(null); return }
    setLoading(true); setError(false)
    const params = new URLSearchParams({ from: dateDebut, to: dateFin })
    if (excludeSessionId) params.set('exclude_session_id', excludeSessionId)
    fetch(`/api/formateurs/${formateurId}/dispo?${params}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [formateurId, dateDebut, dateFin, excludeSessionId])

  if (loading) {
    return (
      <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-2.5 text-sm text-surface-600 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Vérification de la disponibilité…
      </div>
    )
  }

  if (error || !data) return null

  if (data.is_available) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-emerald-900">Formateur disponible</div>
          <div className="text-xs text-emerald-700 mt-0.5">
            Aucun conflit détecté{data.google_calendar_connected ? ' (calendrier Google synchronisé)' : ' (Google Calendar non connecté — vérification basée uniquement sur les sessions Lab Learning)'}.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm space-y-1.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="font-medium text-amber-900">{data.conflicts.length} conflit{data.conflicts.length > 1 ? 's' : ''} détecté{data.conflicts.length > 1 ? 's' : ''}</div>
      </div>
      <div className="space-y-1 ml-6">
        {data.conflicts.map((c, i) => (
          <div key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
            {c.source === 'session' ? <Building2 className="h-3 w-3 mt-0.5 shrink-0" /> : <Calendar className="h-3 w-3 mt-0.5 shrink-0" />}
            <span>
              <strong>{c.title}</strong>
              {c.reference && ` (${c.reference})`}
              {' '}— du {new Date(c.date_debut).toLocaleDateString('fr-FR')} au {new Date(c.date_fin).toLocaleDateString('fr-FR')}
              <span className="text-amber-600 ml-1">[{c.source === 'session' ? 'Session Lab Learning' : 'Google Calendar'}]</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
