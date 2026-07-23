import { createServiceRoleClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '@/lib/types/formation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Calendar, MapPin, Video, Users, Clock, BookOpen } from 'lucide-react'
import type { SessionStatus } from '@/lib/types/formation'

/**
 * Vue « Mes sessions » du formateur, partagée entre l'espace connecté
 * (/mon-espace) et l'accès par lien (/portail/{token}). Les liens internes
 * utilisent `basePath`.
 */
export async function SessionsView({ formateurId, basePath }: { formateurId: string; basePath: string }) {
  const supabase = await createServiceRoleClient()

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      *,
      formation:formation_id(intitule, duree_heures, modalite)
    `)
    .eq('formateur_id', formateurId)
    .order('date_debut', { ascending: false })
  if (error) console.error('[sessions view]', error)

  // Count inscriptions per session (1 seule requête batch au lieu de N)
  const inscritsCounts: Record<string, number> = {}
  const sessionIds = (sessions || []).map((s) => s.id)
  if (sessionIds.length > 0) {
    const { data: inscritRows } = await supabase
      .from('inscriptions')
      .select('session_id')
      .in('session_id', sessionIds)
      .not('status', 'in', '("annule","abandonne")')
    for (const r of inscritRows || []) {
      inscritsCounts[r.session_id] = (inscritsCounts[r.session_id] || 0) + 1
    }
  }
  const sessionsWithCounts = (sessions || []).map((s) => ({
    ...s,
    _nb_inscrits: inscritsCounts[s.id] || 0,
  }))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">Mes sessions</h1>
        <p className="text-surface-500 mt-1">{sessionsWithCounts.length} session{sessionsWithCounts.length > 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {sessionsWithCounts.map((s) => {
          const isToday = s.date_debut <= today && s.date_fin >= today
          return (
            <div key={s.id} className={`card p-5 ${isToday ? 'ring-2 ring-brand-200' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="shrink-0 text-center w-16">
                  <div className={`rounded-xl p-2 ${isToday ? 'bg-brand-50' : 'bg-surface-50'}`}>
                    <div className="text-2xs uppercase text-surface-400">
                      {new Date(s.date_debut).toLocaleDateString('fr-FR', { month: 'short' })}
                    </div>
                    <div className={`text-xl font-heading font-bold ${isToday ? 'text-brand-700' : 'text-surface-700'}`}>
                      {new Date(s.date_debut).getDate()}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={SESSION_STATUS_COLORS[s.status as SessionStatus]} dot>
                      {SESSION_STATUS_LABELS[s.status as SessionStatus]}
                    </Badge>
                    {isToday && <Badge variant="info">Aujourd&apos;hui</Badge>}
                    {s.reference && <span className="text-xs font-mono text-surface-400">{s.reference}</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-surface-900 truncate">
                    {s.formation?.intitule || s.intitule || 'Session'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(s.date_debut, { day: 'numeric', month: 'short' })} — {formatDate(s.date_fin, { day: 'numeric', month: 'short' })}
                    </span>
                    {s.horaires && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.horaires}</span>}
                    {s.lieu && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.lieu}</span>}
                    {s.lien_visio && (
                      <a href={s.lien_visio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-600 hover:text-brand-700">
                        <Video className="h-3.5 w-3.5" /> Visio
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {s._nb_inscrits}/{s.places_max} inscrits
                    </span>
                    {s.formation?.duree_heures && <span>{s.formation.duree_heures}h</span>}
                  </div>
                  {/* Accès au détail : émargement + contenu pédagogique de la session */}
                  <Link
                    href={`${basePath}/emargement/${s.id}`}
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Contenu et émargement
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sessionsWithCounts.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-500">Aucune session assignée</div>
      )}
    </div>
  )
}
