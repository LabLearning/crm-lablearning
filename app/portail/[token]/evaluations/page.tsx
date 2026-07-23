import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui'
import { QCM_TYPE_LABELS, QCM_TYPE_COLORS } from '@/lib/types/evaluation'
import { formatDate } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { FormateurEvaluationsView } from '@/app/mon-espace/_formateur/FormateurEvaluationsView'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

export default async function PortalEvaluationsPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context) redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  if (context.type === 'apprenant') {
    const { data: reponses } = await supabase
      .from('qcm_reponses')
      .select('*, qcm:qcm(titre, type, score_min_reussite)')
      .eq('apprenant_id', context.apprenant.id)
      .order('created_at', { ascending: false })

    const allReponses = reponses || []
    const completed = allReponses.filter((r) => r.is_complete)
    const pending = allReponses.filter((r) => !r.is_complete)

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 tracking-heading">Mes évaluations</h1>
          <p className="text-surface-500 mt-1">{allReponses.length} évaluation{allReponses.length > 1 ? 's' : ''}</p>
        </div>

        {pending.length > 0 && (
          <div className="card p-6 border-warning-200 border">
            <h2 className="text-base font-heading font-semibold text-warning-700 mb-3">En attente</h2>
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-warning-50">
                  <div>
                    <div className="text-sm font-medium text-surface-800">{r.qcm?.titre || 'QCM'}</div>
                    <Badge variant={QCM_TYPE_COLORS[r.qcm?.type as keyof typeof QCM_TYPE_COLORS]}>{QCM_TYPE_LABELS[r.qcm?.type as keyof typeof QCM_TYPE_LABELS]}</Badge>
                  </div>
                  <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />À compléter</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {completed.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-surface-900">{r.qcm?.titre || 'QCM'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={QCM_TYPE_COLORS[r.qcm?.type as keyof typeof QCM_TYPE_COLORS]}>{QCM_TYPE_LABELS[r.qcm?.type as keyof typeof QCM_TYPE_LABELS]}</Badge>
                    <span className="text-xs text-surface-400">{r.completed_at && formatDate(r.completed_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {r.score !== null && (
                    <div className={`text-xl font-heading font-bold ${Number(r.score) >= 70 ? 'text-success-600' : Number(r.score) >= 50 ? 'text-warning-600' : 'text-danger-600'}`}>
                      {r.score}%
                    </div>
                  )}
                  {r.is_reussi === true && <CheckCircle2 className="h-6 w-6 text-success-500" />}
                  {r.is_reussi === false && <XCircle className="h-6 w-6 text-danger-500" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {allReponses.length === 0 && (
          <div className="card p-12 text-center text-sm text-surface-500">Aucune évaluation pour le moment</div>
        )}
      </div>
    )
  }

  // ---- FORMATEUR: received evaluations about them ----
  if (context.type !== 'formateur') redirect('/portail/expired')

  return <FormateurEvaluationsView formateurId={context.formateur.id} />
}
