import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QuestionnairesClient from './QuestionnairesClient'

// Donnees temps reel : jamais de cache statique (acces par token, sans cookies)
export const dynamic = 'force-dynamic'

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

  // Le questionnaire à froid mesure ce qui reste appliqué trois mois après :
  // il est verrouillé jusqu'à J+90 après la fin de session.
  const sessionIds = [...new Set((pendingReponses || []).map((r: any) => r.session_id).filter(Boolean))]
  const { data: sessionsFin } = sessionIds.length
    ? await supabase.from('sessions').select('id, date_fin').in('id', sessionIds)
    : { data: [] as any[] }
  const finPar = new Map((sessionsFin || []).map((s: any) => [s.id, s.date_fin]))
  const aujourdhui = new Date().toISOString().slice(0, 10)
  // Les bonnes réponses et leurs explications ne partent jamais vers le
  // navigateur du stagiaire (la note est calculée côté serveur), et les
  // réponses d'une question de connaissances sont mélangées : dans la banque,
  // la bonne est presque toujours la première. Ordre stable pour un même
  // questionnaire, différent d'un stagiaire à l'autre.
  const graine = (id: string) => { let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
  const melanger = <T,>(liste: T[], id: string): T[] => {
    const l = [...liste]; let x = graine(id) || 1
    for (let i = l.length - 1; i > 0; i--) { x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0; x ^= x >>> 13; const j = x % (i + 1); [l[i], l[j]] = [l[j], l[i]] }
    return l
  }
  const sansCorrige = (pendingReponses || []).map((r: any) => !r.qcm ? r : ({
    ...r,
    qcm: {
      ...r.qcm,
      questions: (r.qcm.questions || []).map((q: any) => {
        const ordonnes = [...(q.choix || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        const connaissance = ordonnes.some((c: any) => c.est_correct) && ordonnes.length > 2
        const choix = (connaissance ? melanger(ordonnes, `${q.id}|${r.id}`) : ordonnes)
          .map((c: any, i: number) => ({ id: c.id, texte: c.texte, position: i, est_correct: false }))
        return { ...q, explication: null, choix }
      }),
    },
  }))

  const pendingAvecVerrou = sansCorrige.map((r: any) => {
    if (r.qcm?.type !== 'satisfaction_froid') return r
    const fin = finPar.get(r.session_id)
    if (!fin) return r
    const dispo = new Date(fin + 'T00:00:00Z')
    dispo.setUTCDate(dispo.getUTCDate() + 90)
    const dispoStr = dispo.toISOString().slice(0, 10)
    return dispoStr > aujourdhui ? { ...r, _disponible_le: dispoStr } : r
  })

  return (
    <QuestionnairesClient
      token={params.token}
      pendingReponses={pendingAvecVerrou as any[]}
      completedReponses={(completedReponses || []) as any[]}
    />
  )
}
