import Link from 'next/link'
import { CalendarDays, MapPin, ChevronRight, Building2 } from '@/components/ui/icons'
import { formatShortDate, todayISO } from './emargement/helpers'

interface SessionRow {
  id: string
  reference?: string | null
  intitule?: string | null
  date_debut: string
  date_fin: string
  lieu?: string | null
  ville?: string | null
  status?: string | null
  formation?: { intitule?: string | null } | null
  client?: { raison_sociale?: string | null; nom_commercial?: string | null; ville?: string | null } | null
}

/**
 * Liste de sessions cliquables pour un formateur, partagée par les rubriques
 * Contenu pédagogique et Questionnaires. Chaque carte mène vers
 * `{basePath}/{segment}/{sessionId}` — `basePath` vaut `/mon-espace` (espace
 * connecté) ou `/portail/{token}` (accès par lien).
 */
export function FormateurSessionList({
  basePath,
  segment,
  title,
  subtitle,
  sessions,
  emptyLabel,
}: {
  basePath: string
  segment: string
  title: string
  subtitle: string
  sessions: SessionRow[]
  emptyLabel: string
}) {
  const today = todayISO()
  // Séance du jour d'abord, puis les sessions à venir par ordre chronologique,
  // puis les terminées de la plus récente à la plus ancienne.
  const cards = [...sessions]
    .map((s) => ({
      ...s,
      _isToday: s.date_debut <= today && s.date_fin >= today,
      _terminee: s.status === 'terminee' || s.date_fin < today,
    }))
    .sort((a, b) => {
      if (a._isToday !== b._isToday) return Number(b._isToday) - Number(a._isToday)
      if (a._terminee !== b._terminee) return Number(a._terminee) - Number(b._terminee)
      return a._terminee
        ? b.date_debut.localeCompare(a.date_debut)
        : a.date_debut.localeCompare(b.date_debut)
    })

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
            href={`${basePath}/${segment}/${s.id}`}
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
                  {s._terminee && !s._isToday && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-violet-50 text-violet-700">
                      Terminée
                    </span>
                  )}
                  {s.reference && (
                    <span className="text-[11px] font-mono text-surface-400">{s.reference}</span>
                  )}
                </div>

                <h2 className="text-sm sm:text-base font-semibold text-surface-900 leading-snug">
                  {s.formation?.intitule || s.intitule || 'Session'}
                </h2>
                {s.client && (
                  <div className="flex items-center gap-1 text-sm font-medium text-brand-700 mt-0.5 min-w-0">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.client.nom_commercial || s.client.raison_sociale}{s.client.ville ? ` · ${s.client.ville}` : ''}</span>
                  </div>
                )}

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
