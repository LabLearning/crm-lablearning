import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SessionHeaderFormateur } from '../../SessionHeaderFormateur'
import { PositionnementList } from '../../ContenuPedagogique'
import { QcmFormateur } from '../QcmFormateur'
import { getPositionnementEtat } from '@/lib/session-contenu'

export const dynamic = 'force-dynamic'

export default async function PortalQcmSessionPage({
  params,
}: {
  params: { token: string; sessionId: string }
}) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') redirect('/portail/expired')

  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale)',
    )
    .eq('id', params.sessionId)
    .maybeSingle()

  // Le sessionId vient de l'URL : il doit appartenir au formateur du token.
  if (!session || session.formateur_id !== context.formateur.id) redirect('/portail/expired')

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant:apprenants(id, prenom, nom)')
    .eq('session_id', session.id)
    .not('status', 'in', '("annule","abandonne")')

  const stagiaires = (inscriptions || [])
    .map((i: any) => i.apprenant)
    .filter(Boolean)
    .sort((a: any, b: any) => `${a.nom}`.localeCompare(`${b.nom}`))

  const [positionnement, qcmSessRes, qcmRepRes] = await Promise.all([
    getPositionnementEtat(
      supabase,
      session.id,
      stagiaires.map((a: any) => ({ id: a.id, prenom: a.prenom, nom: a.nom })),
    ),
    // Questionnaires rattachés à la session
    supabase
      .from('qcm_sessions')
      .select('id, qcm_id, qcm:qcm(id, titre, type, score_min_reussite)')
      .eq('session_id', session.id),
    // Réponses des apprenants (qui a répondu + score)
    supabase
      .from('qcm_reponses')
      .select('qcm_id, apprenant_id, score, is_reussi, is_complete')
      .eq('session_id', session.id),
  ])
  const qcmSessions = (qcmSessRes.data || []) as any[]
  const qcmReponses = (qcmRepRes.data || []) as any[]

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`/portail/${params.token}/qcm`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <SessionHeaderFormateur
        session={session as any}
        formateurName={`${context.formateur.prenom} ${context.formateur.nom}`}
        stagiaires={stagiaires}
      />

      <div className="space-y-4">
        {positionnement.length > 0 && (
          <div className="card p-4 sm:p-5">
            <PositionnementList positionnement={positionnement} />
          </div>
        )}
        <QcmFormateur
          token={params.token}
          sessionId={session.id}
          qcmSessions={qcmSessions}
          qcmReponses={qcmReponses}
          nbStagiaires={stagiaires.length}
        />
        {positionnement.length === 0 && qcmSessions.length === 0 && (
          <div className="card p-8 text-center text-sm text-surface-400">
            Aucun questionnaire pour cette session.
          </div>
        )}
      </div>
    </div>
  )
}
