import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { QCMList } from './QCMList'
import type { QCM } from '@/lib/types/evaluation'

export default async function QCMPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: qcms } = await supabase
    .from('qcm')
    .select(`
      *,
      formation:formations(intitule, reference),
      questions:qcm_questions(*, choix:qcm_choix(*))
    `)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })

  // Count responses per QCM (1 seule requête batch au lieu de N)
  const reponsesCounts: Record<string, number> = {}
  const qcmIds = (qcms || []).map((q) => q.id)
  if (qcmIds.length > 0) {
    const { data: reponseRows } = await supabase
      .from('qcm_reponses')
      .select('qcm_id')
      .in('qcm_id', qcmIds)
      .eq('is_complete', true)
    for (const r of reponseRows || []) {
      reponsesCounts[r.qcm_id] = (reponsesCounts[r.qcm_id] || 0) + 1
    }
  }
  const qcmsWithCounts = (qcms || []).map((q) => ({
    ...q,
    _reponses_count: reponsesCounts[q.id] || 0,
  }))

  const { data: formations } = await supabase
    .from('formations')
    .select('id, intitule')
    .eq('organization_id', session.organization.id)
    .eq('is_active', true)

  return (
    <div className="animate-fade-in">
      <QCMList
        qcms={qcmsWithCounts as QCM[]}
        formations={formations || []}
      />
    </div>
  )
}
