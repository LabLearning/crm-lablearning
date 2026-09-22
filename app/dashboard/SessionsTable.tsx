import Link from 'next/link'
import { Badge } from '@/components/ui'
import { Users, ArrowRight } from '@/components/ui/icons'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '@/lib/types/formation'
import { formatDate } from '@/lib/utils'

/**
 * Tableau de sessions du tableau de bord : formation, client, dates,
 * formateur, inscrits, statut — chaque ligne ouvre la session.
 * Rendu serveur (lignes = liens), style design system.
 */
export interface SessionTableRow {
  id: string
  intitule?: string | null
  formation?: { intitule?: string | null } | null
  client?: { raison_sociale?: string | null } | null
  formateur?: { prenom?: string | null; nom?: string | null } | null
  date_debut: string
  date_fin: string
  status: string
  _inscrits?: number
  /** Cible du clic (par défaut la fiche session) : un parcours POEI ouvre son dossier. */
  _href?: string
  /** Parcours POEI : pas de formateur par nature, on n'affiche pas « à affecter ». */
  _poei?: boolean
}

const GRILLE = 'minmax(0,2.2fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.2fr) 70px 110px'

export function SessionsTable({ titre, sessions, badge, vide, lienTous, compact = false }: {
  titre: string
  sessions: SessionTableRow[]
  badge?: React.ReactNode
  vide: string
  lienTous?: string
  /** Liste de cartes à toutes les largeurs (colonnes côte à côte), sans tableau. */
  compact?: boolean
}) {
  const href = (s: SessionTableRow) => s._href || `/dashboard/sessions/${s.id}`
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {badge}
          <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">{titre}</span>
          <span className="text-xs text-surface-400">{sessions.length}</span>
        </div>
        {lienTous && (
          <Link href={lienTous} className="text-xs text-brand-500 font-medium flex items-center gap-1 min-h-[40px] sm:min-h-0 -my-2 sm:my-0 hover:text-brand-600">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-xs text-surface-400">{vide}</div>
      ) : (
        <>
          {/* Téléphone (et colonnes compactes) : une carte par session, rien à faire défiler latéralement */}
          <div className={`${compact ? '' : 'sm:hidden '}divide-y divide-surface-100`}>
            {sessions.map((s) => (
              <Link key={s.id} href={href(s)}
                className="block px-4 py-3 active:bg-surface-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-surface-900 leading-snug min-w-0 line-clamp-2">
                    {s.intitule || s.formation?.intitule || 'Session'}
                  </span>
                  <Badge variant={(SESSION_STATUS_COLORS as any)[s.status] || 'default'} dot className="shrink-0">
                    {(SESSION_STATUS_LABELS as any)[s.status] || s.status}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-surface-500">
                  <span className="whitespace-nowrap font-medium text-surface-600">
                    {formatDate(s.date_debut, { day: 'numeric', month: 'short' })}
                    {s.date_fin !== s.date_debut ? ` au ${formatDate(s.date_fin, { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                  {s.client?.raison_sociale && <span className="truncate max-w-full">{s.client.raison_sociale}</span>}
                  {(s.formateur || !s._poei) && (
                    <span className="truncate max-w-full">
                      {s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : <span className="text-surface-500 italic">Formateur à affecter</span>}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold ${(s._inscrits || 0) > 0 ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-400'}`}>
                    <Users className="h-3 w-3" /> {s._inscrits || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Tablette et desktop : tableau, défilant dans son conteneur si besoin */}
          {!compact && (
          <div className="hidden sm:block table-scroll">
            <div className="min-w-[760px]">
              {/* En-tête */}
              <div className="grid gap-3 px-4 py-2 bg-surface-50 border-b border-surface-100 text-2xs font-semibold text-surface-400 uppercase tracking-wider"
                style={{ gridTemplateColumns: GRILLE }}>
                <span>Formation</span>
                <span>Client</span>
                <span>Dates</span>
                <span>Formateur</span>
                <span className="text-center">Inscrits</span>
                <span>Statut</span>
              </div>
              <div className="divide-y divide-surface-100">
                {sessions.map((s) => (
                  <Link key={s.id} href={href(s)}
                    className="grid gap-3 px-4 py-2.5 items-center hover:bg-surface-50 transition-colors"
                    style={{ gridTemplateColumns: GRILLE }}>
                    <span className="text-sm font-medium text-surface-900 truncate">
                      {s.intitule || s.formation?.intitule || 'Session'}
                    </span>
                    <span className="text-xs text-surface-500 truncate">{s.client?.raison_sociale || <span className="text-surface-500 italic">Sans client</span>}</span>
                    <span className="text-xs text-surface-500 whitespace-nowrap">
                      {formatDate(s.date_debut, { day: 'numeric', month: 'short' })}
                      {s.date_fin !== s.date_debut ? ` → ${formatDate(s.date_fin, { day: 'numeric', month: 'short' })}` : ''}
                    </span>
                    <span className="text-xs text-surface-500 truncate">
                      {s.formateur ? `${s.formateur.prenom} ${s.formateur.nom}` : s._poei ? <span className="text-surface-400">Parcours POEI</span> : <span className="text-surface-500 italic">à affecter</span>}
                    </span>
                    <span className="flex justify-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold ${(s._inscrits || 0) > 0 ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-400'}`}>
                        <Users className="h-3 w-3" /> {s._inscrits || 0}
                      </span>
                    </span>
                    <span>
                      <Badge variant={(SESSION_STATUS_COLORS as any)[s.status] || 'default'} dot>
                        {(SESSION_STATUS_LABELS as any)[s.status] || s.status}
                      </Badge>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  )
}
