import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, MapPin, Clock, Users, GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export default async function PartenaireSessionsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apporteur') redirect('/portail/expired')
  const supabase = await createServiceRoleClient()

  // Get sessions from dossiers linked to partner's leads — and in parallel,
  // fetch all recent sessions for this org (independent query).
  const [sessionsFromLeads, { data: allSessions }] = await Promise.all([
    (async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, converted_client_id, entreprise')
        .eq('apporteur_id', context.apporteur.id)

      const clientIds = (leads || []).map((l: any) => l.converted_client_id).filter(Boolean)

      if (clientIds.length > 0) {
        const { data: dossiers } = await supabase
          .from('dossiers_formation')
          .select('session_id')
          .in('client_id', clientIds)

        const sessionIds = (dossiers || []).map((d: any) => d.session_id).filter(Boolean)

        if (sessionIds.length > 0) {
          const { data } = await supabase
            .from('sessions')
            .select(`
          id, reference, date_debut, date_fin, horaires, lieu, ville, status, places_max,
          formation:formation_id(intitule, duree_heures, modalite),
          formateur:formateurs(prenom, nom)
        `)
            .in('id', sessionIds)
            .order('date_debut', { ascending: true })
          return data || []
        }
      }
      return []
    })(),
    supabase
      .from('sessions')
      .select(`
      id, reference, date_debut, date_fin, horaires, lieu, ville, status, places_max,
      formation:formation_id(intitule, duree_heures, modalite),
      formateur:formateurs(prenom, nom)
    `)
      .eq('organization_id', context.organization.id)
      .order('date_debut', { ascending: true })
      .limit(30),
  ])

  let sessions: any[] = sessionsFromLeads

  // Merge
  const allIds = new Set(sessions.map((s: any) => s.id))
  ;(allSessions || []).forEach((s: any) => {
    if (!allIds.has(s.id)) { sessions.push(s); allIds.add(s.id) }
  })

  const today = new Date().toISOString().split('T')[0]
  const upcoming = sessions.filter((s: any) => s.date_debut >= today && ['planifiee', 'confirmee'].includes(s.status))
  const enCours = sessions.filter((s: any) => s.status === 'en_cours' || (s.date_debut <= today && s.date_fin >= today && s.status === 'confirmee'))
  const past = sessions.filter((s: any) => s.status === 'terminee')

  // Count inscriptions per session
  const sessionIds = sessions.map((s: any) => s.id)
  let inscCounts: Record<string, number> = {}
  if (sessionIds.length > 0) {
    const { data: inscs } = await supabase
      .from('inscriptions')
      .select('session_id')
      .in('session_id', sessionIds)
      .not('status', 'in', '("annule","abandonne")')
    ;(inscs || []).forEach((i: any) => { inscCounts[i.session_id] = (inscCounts[i.session_id] || 0) + 1 })
  }

  function renderSession(s: any) {
    const inscrits = inscCounts[s.id] || 0
    return (
      <div key={s.id} className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-base font-heading font-semibold text-surface-900">{s.formation?.intitule || s.reference}</div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-surface-500">
              {s.date_debut && (
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
                  {formatDate(s.date_debut, { day: 'numeric', month: 'long' })}{s.date_fin && s.date_fin !== s.date_debut ? ' - ' + formatDate(s.date_fin, { day: 'numeric', month: 'long' }) : ''}
                </span>
              )}
              {s.horaires && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.horaires}</span>}
              {(s.lieu || s.ville) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.lieu || s.ville}</span>}
              {s.formation?.duree_heures && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{s.formation.duree_heures}h</span>}
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{inscrits}/{s.places_max || '?'} inscrits</span>
            </div>
            {s.formateur && <div className="text-xs text-surface-400 mt-1.5">Formateur : {s.formateur.prenom} {s.formateur.nom}</div>}
          </div>
          <Badge variant={s.status === 'terminee' ? 'success' : s.status === 'en_cours' || (s.date_debut <= today && s.date_fin >= today) ? 'info' : s.status === 'confirmee' ? 'success' : 'default'}>
            {s.status === 'terminee' ? 'Terminee' : s.status === 'en_cours' ? 'En cours' : s.status === 'confirmee' ? 'Confirmee' : 'Planifiee'}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Sessions de formation</h1>
      <p className="text-surface-500 text-sm mb-6">Planning des sessions</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'En cours', value: enCours.length, color: 'text-blue-600' },
          { label: 'A venir', value: upcoming.length, color: 'text-brand-600' },
          { label: 'Terminees', value: past.length, color: 'text-success-600' },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <div className={`text-2xl font-heading font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-surface-400 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {enCours.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">En cours</div>
          <div className="space-y-3">{enCours.map(renderSession)}</div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">A venir</div>
          <div className="space-y-3">{upcoming.map(renderSession)}</div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Terminees</div>
          <div className="space-y-3">{past.map(renderSession)}</div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-16">
          <Calendar className="h-8 w-8 text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">Aucune session pour le moment</p>
        </div>
      )}
    </div>
  )
}
