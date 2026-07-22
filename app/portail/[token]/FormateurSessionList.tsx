import Link from 'next/link'
import { CalendarDays, MapPin, ChevronRight } from 'lucide-react'
import { formatShortDate, todayISO } from './emargement/helpers'

interface SessionRow {
  id: string
  reference?: string | null
  intitule?: string | null
  date_debut: string
  date_fin: string
  lieu?: string | null
  ville?: string | null
  formation?: { intitule?: string | null } | null
}

/**
 * Liste de sessions cliquables pour un formateur, partagée par les rubriques
 * Contenu pédagogique et Questionnaires. Chaque carte mène vers
 * `/portail/{token}/{segment}/{sessionId}`.
 */
export function FormateurSessionList({
  token,
  segment,
  title,
  subtitle,
  sessions,
  emptyLabel,
}: {
  token: string
  segment: string
  title: string
  subtitle: string
  sessions: SessionRow[]
  emptyLabel: string
}) {
  const today = todayISO()
  const cards = [...sessions]
    .map((s) => ({ ...s, _isToday: s.date_debut <= today && s.date_fin >= today }))
    .sort((a, b) => Number(b._isToday) - Number(a._isToday))

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">
          {title}
        </h1>
        <p className="text-surface-500 mt-1 text-sm">{subtitle}</p>
      </div>

      {cards.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-500">
          <CalendarDays className="h-8 w-8 mx-auto mb-3 text-surface-300" />
          {emptyLabel}
        </div>
      )}

      <div className="space-y-3">
        {cards.map((s) => (
          <Link
            key={s.id}
            href={`/portail/${token}/${segment}/${s.id}`}
            className={`card block p-4 sm:p-5 transition-colors active:bg-surface-50 hover:border-surface-300 ${
              s._isToday ? 'ring-2 ring-emerald-200' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {s._isToday && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      Séance du jour
                    </span>
                  )}
                  {s.reference && (
                    <span className="text-[11px] font-mono text-surface-400">{s.reference}</span>
                  )}
                </div>

                <h2 className="text-sm sm:text-base font-semibold text-surface-900 leading-snug">
                  {s.formation?.intitule || s.intitule || 'Session'}
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-surface-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatShortDate(s.date_debut)} — {formatShortDate(s.date_fin)}
                  </span>
                  {(s.lieu || s.ville) && (
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{s.lieu || s.ville}</span>
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-surface-300 shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
