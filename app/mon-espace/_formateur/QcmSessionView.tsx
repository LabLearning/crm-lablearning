import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from '@/components/ui/icons'
import { RafraichissementAuto } from '@/components/ui/RafraichissementAuto'
import { SessionHeaderFormateur } from '@/app/portail/[token]/SessionHeaderFormateur'
import { PositionnementList } from '@/app/portail/[token]/ContenuPedagogique'
import { QcmFormateur } from '@/app/portail/[token]/qcm/QcmFormateur'
import { getPositionnementEtat } from '@/lib/session-contenu'

/**
 * Détail des questionnaires d'une session, partagé espace connecté / portail.
 * Ownership vérifiée sur le formateur. `token` transmis à QcmFormateur, qui
 * gère l'authentification de l'API QR selon `basePath`.
 */
export async function QcmSessionView({
  formateurId,
  formateurName,
  token,
  basePath,
  sessionId,
  deniedRedirect,
}: {
  formateurId: string
  formateurName: string
  token: string
  basePath: string
  sessionId: string
  deniedRedirect: string
}) {
  const supabase = await createServiceRoleClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, reference, intitule, date_debut, date_fin, horaires, lieu, adresse, code_postal, ville, formateur_id, organization_id, formation:formation_id(intitule, duree_heures), client:client_id(raison_sociale, nom_commercial, sigle)',
    )
    .eq('id', sessionId)
    .maybeSingle()

  // Le sessionId vient de l'URL : il doit appartenir au formateur.
  if (!session || session.formateur_id !== formateurId) redirect(deniedRedirect)

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
      .select('id, qcm_id, date_ouverture, qcm:qcm(id, titre, type, score_min_reussite)')
      .eq('session_id', session.id),
    // Réponses des apprenants (qui a répondu + score)
    supabase
      .from('qcm_reponses')
      .select('id, qcm_id, apprenant_id, score, is_reussi, is_complete')
      .eq('session_id', session.id),
  ])
  // Dans l'ordre du cours : les titres commencent par la séance (S01, S02…) ;
  // le questionnaire à froid, envoyé trois mois après, ferme la liste
  const aFroid = (q: any) => (q.qcm?.type === 'satisfaction_froid' ? 1 : 0)
  const qcmSessions = ((qcmSessRes.data || []) as any[])
    .sort((a, b) => aFroid(a) - aFroid(b) || String(a.qcm?.titre || '').localeCompare(String(b.qcm?.titre || ''), 'fr', { numeric: true }))
  const qcmReponses = (qcmRepRes.data || []) as any[]

  // Questions et corrigé de chaque questionnaire, et ce que chaque stagiaire a
  // répondu : le formateur corrige en salle. Rien de tout cela n'est envoyé au
  // navigateur des stagiaires (leur portail retire les bonnes réponses).
  const qcmIds = Array.from(new Set(qcmSessions.map((q: any) => q.qcm_id).filter(Boolean))) as string[]
  const faites = qcmReponses.filter((r: any) => r.is_complete).map((r: any) => r.id as string)
  const [questionsRes, details] = await Promise.all([
    qcmIds.length
      ? supabase.from('qcm_questions')
        .select('id, qcm_id, texte, type, explication, position, choix:qcm_choix(id, texte, est_correct, position)')
        .in('qcm_id', qcmIds)
        .order('position', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    // Par paquets : 40 réponses × 20 questions restent sous le plafond de 1 000 lignes
    (async () => {
      const lignes: any[] = []
      for (let i = 0; i < faites.length; i += 40) {
        const { data } = await supabase.from('qcm_reponses_detail')
          .select('reponse_id, question_id, choix_ids, texte_libre, est_correct, note_valeur')
          .in('reponse_id', faites.slice(i, i + 40))
        lignes.push(...(data || []))
      }
      return lignes
    })(),
  ])
  const questions = ((questionsRes as any).data || []) as any[]

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`${basePath}/qcm`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 active:text-surface-800"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>

      <SessionHeaderFormateur
        session={session as any}
        formateurName={formateurName}
        stagiaires={stagiaires}
      />

      {/* En salle : les réponses des stagiaires arrivent sans recharger la page */}
      <RafraichissementAuto secondes={20} />

      <div className="space-y-4">
        {/* L'accès des stagiaires (QR codes) et les questionnaires d'abord : c'est
            par là que commence la séance */}
        <QcmFormateur
          token={token}
          basePath={basePath}
          sessionId={session.id}
          qcmSessions={qcmSessions}
          qcmReponses={qcmReponses}
          stagiaires={stagiaires}
          questions={questions}
          details={details}
        />
        {positionnement.length > 0 && (
          <div className="card p-4 sm:p-5">
            <PositionnementList positionnement={positionnement} />
          </div>
        )}
        {positionnement.length === 0 && qcmSessions.length === 0 && (
          <div className="card p-8 text-center text-sm text-surface-400">
            Aucun questionnaire pour cette session.
          </div>
        )}
      </div>
    </div>
  )
}
