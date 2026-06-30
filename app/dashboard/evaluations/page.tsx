import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { EvaluationsDashboard } from './EvaluationsDashboard'
import type { QCMReponse, EvaluationSatisfaction } from '@/lib/types/evaluation'

export default async function EvaluationsPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: reponses }, { data: satisfactions }] = await Promise.all([
    supabase
      .from('qcm_reponses')
      .select(`
        *,
        apprenant:apprenants(prenom, nom, email),
        qcm:qcm(titre, type, score_min_reussite)
      `)
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('evaluations_satisfaction')
      .select('*')
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="animate-fade-in">
      <EvaluationsDashboard
        reponses={(reponses || []) as QCMReponse[]}
        satisfactions={(satisfactions || []) as EvaluationSatisfaction[]}
      />
    </div>
  )
}
