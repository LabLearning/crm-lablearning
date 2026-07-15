import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui'
import { INSCRIPTION_STATUS_LABELS, INSCRIPTION_STATUS_COLORS } from '@/lib/types/formation'
import { formatDate } from '@/lib/utils'
import type { InscriptionStatus } from '@/lib/types/formation'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function PortalFormationsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apprenant') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select(`
      *,
      session:sessions(reference, date_debut, date_fin, horaires, lieu, lien_visio, status,
        formation:formation_id(intitule, duree_heures, modalite, objectifs_pedagogiques, programme_detaille)
      )
    `)
    .eq('apprenant_id', context.apprenant.id)
    .order('date_inscription', { ascending: false })

  const allIns = inscriptions || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-surface-900 tracking-heading">Mes formations</h1>
        <p className="text-surface-500 mt-1">{allIns.length} formation{allIns.length > 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-4">
        {allIns.map((ins) => {
          const formation = ins.session?.formation
          const session = ins.session
          return (
            <div key={ins.id} className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-heading font-semibold text-surface-900 tracking-tight truncate">
                    {formation?.intitule || 'Formation'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={INSCRIPTION_STATUS_COLORS[ins.status as InscriptionStatus]}>
                      {INSCRIPTION_STATUS_LABELS[ins.status as InscriptionStatus]}
                    </Badge>
                    {formation?.modalite && <Badge variant="default">{formation.modalite}</Badge>}
                    {session?.reference && <span className="text-xs text-surface-400 font-mono">{session.reference}</span>}
                  </div>
                </div>
                {formation?.duree_heures && (
                  <div className="text-right shrink-0">
                    <div className="text-lg font-heading font-bold text-brand-600">{formation.duree_heures}h</div>
                    <div className="text-2xs text-surface-400">durée</div>
                  </div>
                )}
              </div>

              {/* Dates & lieu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-surface-50">
                  <div className="text-2xs text-surface-400">Dates</div>
                  <div className="text-sm text-surface-800">
                    {session?.date_debut && formatDate(session.date_debut, { day: 'numeric', month: 'long' })}
                    {session?.date_fin && ` — ${formatDate(session.date_fin, { day: 'numeric', month: 'long' })}`}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface-50">
                  <div className="text-2xs text-surface-400">Lieu</div>
                  <div className="text-sm text-surface-800">{session?.lieu || 'Non défini'}</div>
                </div>
                <div className="p-3 rounded-xl bg-surface-50">
                  <div className="text-2xs text-surface-400">Horaires</div>
                  <div className="text-sm text-surface-800">{session?.horaires || 'Non défini'}</div>
                </div>
              </div>

              {/* Visio link */}
              {session?.lien_visio && (
                <a href={session.lien_visio} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-50 text-sm text-brand-700 font-medium hover:bg-brand-100 transition-colors mb-4">
                  Rejoindre la visioconférence
                </a>
              )}

              {/* Progression */}
              {ins.taux_assiduite > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-surface-500 mb-1">
                    <span>Assiduité</span><span>{ins.taux_assiduite}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-200">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${ins.taux_assiduite}%` }} />
                  </div>
                </div>
              )}

              {/* Results */}
              {(ins.note_evaluation_entree !== null || ins.note_evaluation_sortie !== null) && (
                <div className="flex gap-6 text-sm pt-3 border-t border-surface-100">
                  {ins.note_evaluation_entree !== null && (
                    <div><span className="text-surface-500">Évaluation entrée : </span><strong>{ins.note_evaluation_entree}/20</strong></div>
                  )}
                  {ins.note_evaluation_sortie !== null && (
                    <div><span className="text-surface-500">Évaluation sortie : </span><strong>{ins.note_evaluation_sortie}/20</strong></div>
                  )}
                  {ins.progression !== null && (
                    <div className="text-success-600 font-medium">Progression : +{ins.progression}%</div>
                  )}
                </div>
              )}

              {/* Objectives */}
              {formation?.objectifs_pedagogiques && formation.objectifs_pedagogiques.length > 0 && (
                <details className="mt-4 pt-3 border-t border-surface-100">
                  <summary className="text-sm font-medium text-surface-700 cursor-pointer hover:text-brand-600">
                    Objectifs pédagogiques
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {formation.objectifs_pedagogiques.map((obj: any, i: number) => (
                      <li key={i} className="text-sm text-surface-600 pl-4 relative before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-400">
                        {obj}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })}
      </div>

      {allIns.length === 0 && (
        <div className="card p-12 text-center text-sm text-surface-500">
          Aucune formation inscrite pour le moment.
        </div>
      )}
    </div>
  )
}
