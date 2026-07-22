import { CalendarDays, Clock, MapPin, Building2, User, Users } from 'lucide-react'
import { formatShortDate } from './emargement/helpers'

/**
 * Bloc d'infos d'une session côté formateur (formation, client, dates,
 * horaires, lieu, formateur, pastilles stagiaires). Partagé par les pages
 * détail Émargement, Contenu pédagogique et Questionnaires pour éviter la
 * triple duplication. Le slot `badge` reste propre à chaque page.
 */
export function SessionHeaderFormateur({
  session,
  formateurName,
  stagiaires,
  badge,
}: {
  session: {
    reference?: string | null
    intitule?: string | null
    date_debut: string
    date_fin: string
    horaires?: string | null
    lieu?: string | null
    adresse?: string | null
    code_postal?: string | null
    ville?: string | null
    formation?: { intitule?: string | null; duree_heures?: number | null } | null
    client?: { raison_sociale?: string | null } | null
  }
  formateurName: string
  stagiaires: { prenom: string; nom: string }[]
  badge?: React.ReactNode
}) {
  const formation = session.formation
  const client = session.client
  const adresseComplete = [
    session.adresse,
    [session.code_postal, session.ville].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="card p-4 sm:p-5">
      {(badge || session.reference) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {badge}
          {session.reference && (
            <span className="text-[11px] font-mono text-surface-400">{session.reference}</span>
          )}
        </div>
      )}

      <h1 className="text-lg sm:text-xl font-heading font-bold text-surface-900 tracking-heading leading-snug">
        {formation?.intitule || session.intitule || 'Session'}
      </h1>

      <div className="mt-3 grid gap-2 text-sm text-surface-600 sm:grid-cols-2">
        {client?.raison_sociale && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-surface-400 shrink-0" />
            <span className="truncate">{client.raison_sociale}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-surface-400 shrink-0" />
          <span>
            {formatShortDate(session.date_debut)} — {formatShortDate(session.date_fin)}
            {formation?.duree_heures ? ` · ${formation.duree_heures}h` : ''}
          </span>
        </div>
        {session.horaires && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-surface-400 shrink-0" />
            <span className="truncate">{session.horaires}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-surface-400 shrink-0" />
          <span className="truncate">{formateurName}</span>
        </div>
        {(session.lieu || adresseComplete) && (
          <div className="flex items-start gap-2 sm:col-span-2">
            <MapPin className="h-4 w-4 text-surface-400 shrink-0 mt-0.5" />
            <span>
              {session.lieu}
              {session.lieu && adresseComplete ? ' — ' : ''}
              {adresseComplete}
            </span>
          </div>
        )}
      </div>

      {stagiaires.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">
            <Users className="h-3.5 w-3.5" />
            {stagiaires.length} stagiaire{stagiaires.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {stagiaires.map((a, i) => (
              <span
                key={i}
                className="text-xs text-surface-700 bg-surface-100 rounded-full px-2.5 py-1"
              >
                {a.prenom} {a.nom}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
