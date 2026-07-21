import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { CalendarDays, MapPin, Users, ChevronRight, CheckCircle2, CheckSquare } from 'lucide-react'
import { formatShortDate, todayISO } from './helpers'

export const dynamic = 'force-dynamic'

export default async function PortalEmargementPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  // Sessions actives du formateur. « planifiee » est incluse : une session
  // POEI d'intervention le reste jusqu'à son démarrage, et le formateur doit
  // pouvoir émarger dès le premier jour.
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, intitule, date_debut, date_fin, lieu, ville, organization_id, formation:formation_id(intitule)')
    .eq('formateur_id', context.formateur.id)
    .in('status', ['planifiee', 'confirmee', 'en_attente_signatures', 'validee', 'en_cours'])
    .order('date_debut', { ascending: true })

  const sessionIds = (sessions || []).map((s) => s.id)

  // Les feuilles n'étaient créées qu'à l'ouverture de la fiche session par un
  // administrateur : sans cette visite, le formateur n'avait rien à signer.
  const { ensureEmargements } = await import('@/lib/emargements')
  await Promise.all(
    (sessions || []).map((s: any) => ensureEmargements(supabase, s.id, s.organization_id)),
  )

  let emargements: any[] = []
  let feuilles: any[] = []

  if (sessionIds.length > 0) {
    const [emRes, fRes] = await Promise.all([
      supabase
        .from('emargements')
        .select('session_id, apprenant_id, date, creneau')
        .in('session_id', sessionIds),
      supabase
        .from('emargement_feuilles')
        .select('session_id, date, creneau, validated_at')
        .in('session_id', sessionIds),
    ])
    emargements = emRes.data || []
    feuilles = fRes.data || []
  }

  const today = todayISO()

  const cards = (sessions || []).map((s: any) => {
    const sessionEm = emargements.filter((e) => e.session_id === s.id)
    const stagiaires = new Set(sessionEm.map((e) => e.apprenant_id)).size
    const feuillesKeys = new Set(sessionEm.map((e) => `${e.date}|${e.creneau}`))
    const validated = feuilles.filter(
      (f) => f.session_id === s.id && f.validated_at && feuillesKeys.has(`${f.date}|${f.creneau}`),
    ).length

    return {
      ...s,
      _stagiaires: stagiaires,
      _feuilles: feuillesKeys.size,
      _validated: validated,
      _isToday: s.date_debut <= today && s.date_fin >= today,
    }
  })

  // Une séance en cours passe devant : c'est celle sur laquelle le formateur agit
  cards.sort((a: any, b: any) => Number(b._isToday) - Number(a._isToday))

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">
          Émargement
        </h1>
        <p className="text-surface-500 mt-1 text-sm">
          Choisissez une session pour émarger, en signature numérique ou sur feuille papier.
        </p>
      </div>

      {cards.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-500">
          <CalendarDays className="h-8 w-8 mx-auto mb-3 text-surface-300" />
          Aucune session active
        </div>
      )}

      <div className="space-y-3">
        {cards.map((s: any) => {
          const complete = s._feuilles > 0 && s._validated === s._feuilles
          const progress = s._feuilles > 0 ? Math.round((s._validated / s._feuilles) * 100) : 0

          return (
            <Link
              key={s.id}
              href={`/portail/${params.token}/emargement/${s.id}`}
              className={`card block p-4 sm:p-5 transition-colors active:bg-surface-50 hover:border-surface-300 ${
                s._isToday ? 'ring-2 ring-emerald-200' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {s._isToday && <Badge variant="success">Séance du jour</Badge>}
                    {complete && !s._isToday && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Complet
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
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {s._stagiaires} stagiaire{s._stagiaires > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-surface-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${complete ? 'bg-emerald-500' : 'bg-surface-900'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-surface-600 shrink-0 flex items-center gap-1">
                      <CheckSquare className="h-3.5 w-3.5 text-surface-400" />
                      {s._validated}/{s._feuilles} feuilles
                    </span>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-surface-300 shrink-0 mt-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
