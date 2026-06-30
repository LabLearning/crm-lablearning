import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QuestionnairesClient from './QuestionnairesClient'

export default async function PortalQuestionnairesPage({ params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'apprenant') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  // Pending QCMs with full questions + choices for the player + Completed QCMs (summary only)
  const [{ data: pendingReponses }, { data: completedReponses }] = await Promise.all([
    supabase
      .from('qcm_reponses')
      .select(`
      *,
      qcm:qcm(
        titre, type, description, duree_minutes, score_min_reussite,
        questions:qcm_questions(
          id, texte, type, position, points, explication,
          choix:qcm_choix(id, texte, est_correct, position)
        )
      )
    `)
      .eq('apprenant_id', context.apprenant.id)
      .eq('is_complete', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('qcm_reponses')
      .select(`
      *,
      qcm:qcm(titre, type, score_min_reussite)
    `)
      .eq('apprenant_id', context.apprenant.id)
      .eq('is_complete', true)
      .order('completed_at', { ascending: false }),
  ])

  return (
    <QuestionnairesClient
      token={params.token}
      pendingReponses={(pendingReponses || []) as any[]}
      completedReponses={(completedReponses || []) as any[]}
    />
  )
}
