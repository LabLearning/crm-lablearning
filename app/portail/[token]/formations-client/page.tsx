import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, Clock, MapPin, Users, GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { getSessionSupports } from '@/lib/session-contenu'
import { SupportsList } from '../ContenuPedagogique'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function ClientFormationsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'client') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  // Get sessions linked to this client via dossiers
  const { data: dossiers } = await supabase
    .from('dossiers_formation')
    .select(`
      id, status,
      session:sessions(
        id, reference, date_debut, date_fin, horaires, lieu, status,
        formation:formation_id(intitule, duree_heures, modalite)
      )
    `)
    .eq('client_id', context.client.id)
    .order('created_at', { ascending: false })

  const allSessions = [
    ...(dossiers || []).filter((d: any) => d.session).map((d: any) => d.session),
  ].filter((s, i, arr) => s && arr.findIndex((x: any) => x?.id === s.id) === i)

  // Le client ne voit que les supports explicitement ouverts à tout le monde
  const supportsBySession = await getSessionSupports(supabase, allSessions.map((s: any) => s.id), 'client')

  const upcoming = allSessions.filter((s: any) => s.status !== 'terminee' && s.status !== 'annulee')
  const past = allSessions.filter((s: any) => s.status === 'terminee')

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-heading font-bold text-surface-900 tracking-heading mb-1">Formations</h1>
      <p className="text-surface-500 text-sm mb-6">Planning des formations de votre etablissement</p>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">A venir / En cours</div>
          <div className="space-y-3">
            {upcoming.map((s: any) => (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-base font-heading font-semibold text-surface-900">{s.formation?.intitule || s.reference}</div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-surface-500">
                      {s.date_debut && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(s.date_debut, { day: 'numeric', month: 'long', year: 'numeric' })}{s.date_fin && s.date_fin !== s.date_debut ? ' - ' + formatDate(s.date_fin, { day: 'numeric', month: 'long' }) : ''}</span>}
                      {s.horaires && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.horaires}</span>}
                      {s.lieu && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.lieu}</span>}
                      {s.formation?.duree_heures && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{s.formation.duree_heures}h</span>}
                    </div>
                    {s.formation?.modalite && <Badge className="mt-2">{s.formation.modalite}</Badge>}
                  </div>
                  <Badge variant={s.status === 'en_cours' ? 'success' : s.status === 'confirmee' ? 'info' : 'default'}>
                    {s.status === 'en_cours' ? 'En cours' : s.status === 'confirmee' ? 'Confirmee' : 'Planifiee'}
                  </Badge>
                </div>
                {(supportsBySession[s.id] || []).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-surface-100">
                    <SupportsList supports={supportsBySession[s.id]} token={params.token} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Terminees</div>
          <div className="space-y-2">
            {past.map((s: any) => (
              <div key={s.id} className="card p-4 opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-surface-800">{s.formation?.intitule || s.reference}</div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      {s.date_debut && formatDate(s.date_debut, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {s.formation?.duree_heures && ' - ' + s.formation.duree_heures + 'h'}
                    </div>
                  </div>
                  <Badge variant="success">Terminee</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allSessions.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-16">
          <GraduationCap className="h-8 w-8 text-surface-300 mb-3" />
          <p className="text-sm text-surface-500">Aucune formation pour le moment</p>
        </div>
      )}
    </div>
  )
}
