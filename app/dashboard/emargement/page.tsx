import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { creneauLabel, formatFullDate } from '@/app/portail/[token]/emargement/helpers'

export default async function DashboardEmargementPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Trouver la fiche formateur
  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (!formateur) redirect('/dashboard/formateur-home')

  // Sessions actives du formateur
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, reference, date_debut, date_fin, formation:formation_id(intitule)')
    .eq('formateur_id', formateur.id)
    .in('status', ['confirmee', 'en_cours'])
    .order('date_debut', { ascending: true })

  // Émargements de ces sessions
  const sessionIds = (sessions || []).map(s => s.id)
  let emargements: any[] = []
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('emargements')
      .select('id, session_id, apprenant_id, date, creneau, est_present, apprenant:apprenants(prenom, nom)')
      .in('session_id', sessionIds)
      .order('date', { ascending: true })
    emargements = data || []
  }

  // Grouper par session puis date
  const bySession = (sessions || []).map(s => {
    const sessionEmargements = emargements.filter(e => e.session_id === s.id)
    const dates = [...new Set(sessionEmargements.map(e => e.date))].sort()
    return {
      ...s,
      dates: dates.map(date => ({
        date,
        emargements: sessionEmargements.filter(e => e.date === date),
      })),
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Émargement</h1>
        <p className="text-surface-500 mt-1 text-sm">
          Feuilles de présence de vos sessions. La signature se fait depuis votre espace formateur.
        </p>
      </div>

      {bySession.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-500">Aucune session active</div>
      )}

      {bySession.map((s: any) => (
        <div key={s.id} className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-200">
            <h2 className="text-sm font-semibold text-surface-900">
              {s.formation?.intitule || s.reference}
            </h2>
          </div>
          {s.dates.map((d: any) => (
            <div key={d.date} className="border-b border-surface-100 last:border-0">
              <div className="px-4 py-2 bg-surface-50/60 text-xs font-medium text-surface-600 capitalize">
                {formatFullDate(d.date)}
              </div>
              {d.emargements.map((em: any) => (
                <div key={em.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  {em.est_present ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-surface-300 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-surface-800">
                    {em.apprenant?.prenom} {em.apprenant?.nom}
                  </span>
                  <span className="text-xs text-surface-400">{creneauLabel(em.creneau)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
