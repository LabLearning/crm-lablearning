import { NextRequest, NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { enregistrerReponses } from '@/lib/qcm-notation'

export const dynamic = 'force-dynamic'

const JALONS: Record<string, string> = {
  positionnement: 'positionnement',
  entree: 'positionnement',
  sortie: 'evaluation_acquis',
  satisfaction_chaud: 'satisfaction_chaud',
}

/**
 * API machine des grilles de saisie — même token que la page du formateur,
 * pensée pour un agent IA qui a déjà les réponses dans son espace de travail.
 *
 * GET  /api/grilles/<token>          → questionnaires en attente (questions,
 *                                      choix avec leurs ids, stagiaires)
 * POST /api/grilles/<token>          → { session_id, qcm_id,
 *                                      reponses: { apprenant_id: { question_id: valeur } } }
 *   valeur = id du choix (QCM), note "1".."10" (échelles), texte (libre).
 *
 * Mêmes garde-fous que la page : périmètre limité aux sessions du formateur,
 * jamais de modification d'une réponse déjà complétée, notation partagée.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
  const supabase = await createServiceRoleClient()

  const { data: sessions } = await supabase.from('sessions')
    .select('id, reference, date_debut, intitule, client:client_id(raison_sociale, nom_commercial), formation:formation_id(intitule)')
    .eq('formateur_id', (context as any).formateur.id)
    .not('reference', 'like', 'BPF-%')
    .order('date_debut', { ascending: false })
    .range(0, 499)
  const ids = (sessions || []).map((s: any) => s.id)
  if (!ids.length) return NextResponse.json({ formateur: (context as any).formateur.prenom + ' ' + (context as any).formateur.nom, sessions: [] })

  const seq = async (table: string, cols: string) => {
    const out: any[] = []
    for (let i = 0; i < ids.length; i += 80) {
      const { data } = await supabase.from(table).select(cols).in('session_id', ids.slice(i, i + 80))
      out.push(...(data || []))
    }
    return out
  }
  const [liens, inscriptions, reponses] = await Promise.all([
    seq('qcm_sessions', 'session_id, qcm_id'),
    seq('inscriptions', 'session_id, apprenant:apprenant_id(id, prenom, nom)'),
    seq('qcm_reponses', 'session_id, qcm_id, apprenant_id, is_complete'),
  ])
  const qcmIds = [...new Set(liens.map((l: any) => l.qcm_id))]
  const [{ data: qcms }, { data: questions }] = await Promise.all([
    qcmIds.length ? supabase.from('qcm').select('id, type').in('id', qcmIds) : Promise.resolve({ data: [] as any[] }),
    qcmIds.length ? supabase.from('qcm_questions')
      .select('id, qcm_id, texte, type, position, choix:qcm_choix(id, texte, position)')
      .in('qcm_id', qcmIds).order('position', { ascending: true }) : Promise.resolve({ data: [] as any[] }),
  ])
  const typeQcm = new Map((qcms || []).map((q: any) => [q.id, q.type]))
  const questionsParQcm = new Map<string, any[]>()
  for (const q of questions || []) {
    if (!questionsParQcm.has((q as any).qcm_id)) questionsParQcm.set((q as any).qcm_id, [])
    questionsParQcm.get((q as any).qcm_id)!.push(q)
  }
  const faits = new Set((reponses || []).filter((r: any) => r.is_complete)
    .map((r: any) => `${r.session_id}|${r.qcm_id}|${r.apprenant_id}`))

  const out = (sessions || []).map((s: any) => {
    const inscrits = inscriptions.filter((i: any) => i.session_id === s.id).map((i: any) => i.apprenant).filter(Boolean)
    const grilles = liens.filter((l: any) => l.session_id === s.id).map((l: any) => {
      const jalon = JALONS[typeQcm.get(l.qcm_id) as string]
      const qs = questionsParQcm.get(l.qcm_id) || []
      if (!jalon || !qs.length) return null
      const enAttente = inscrits.filter((a: any) => !faits.has(`${s.id}|${l.qcm_id}|${a.id}`))
      if (!enAttente.length) return null
      return {
        qcm_id: l.qcm_id,
        jalon,
        stagiaires: enAttente.map((a: any) => ({ apprenant_id: a.id, nom: `${a.prenom} ${a.nom}` })),
        questions: qs.map((q: any) => ({
          question_id: q.id,
          texte: q.texte,
          type: (q.choix || []).length ? 'choix' : q.type === 'texte_libre' ? 'texte_libre' : q.type,
          choix: (q.choix || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((c: any) => ({ choix_id: c.id, texte: c.texte })),
        })),
      }
    }).filter(Boolean)
    if (!grilles.length) return null
    return {
      session_id: s.id,
      reference: s.reference,
      date_debut: s.date_debut,
      client: s.client?.nom_commercial || s.client?.raison_sociale || null,
      formation: s.formation?.intitule || s.intitule || null,
      grilles,
    }
  }).filter(Boolean)

  return NextResponse.json({
    formateur: `${(context as any).formateur.prenom} ${(context as any).formateur.nom}`,
    mode_emploi: 'POST sur cette même URL : { session_id, qcm_id, reponses: { <apprenant_id>: { <question_id>: valeur } } }. Valeur = choix_id pour une question à choix, "1".."10" pour une note, texte libre sinon. Une réponse déjà complétée est refusée.',
    sessions: out,
  })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const context = await getPortalContext(params.token)
  if (!context || context.type !== 'formateur') return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })

  let corps: any
  try { corps = await req.json() } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }
  const { session_id, qcm_id, reponses } = corps || {}
  if (!session_id || !qcm_id || typeof reponses !== 'object' || !reponses) {
    return NextResponse.json({ error: 'Attendu : { session_id, qcm_id, reponses: { apprenant_id: { question_id: valeur } } }' }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()
  const { data: sess } = await supabase.from('sessions')
    .select('id, organization_id, date_debut, date_fin').eq('id', session_id)
    .eq('formateur_id', (context as any).formateur.id).maybeSingle()
  if (!sess) return NextResponse.json({ error: 'Session introuvable ou hors de votre périmètre' }, { status: 404 })

  // Mêmes règles que la grille du portail (enregistrerGrillePortailAction) :
  // questionnaire rattaché à la session, d'un type que la grille propose (la
  // satisfaction à froid revient au stagiaire seul), et rempli à son heure
  const TYPES_GRILLE = ['positionnement', 'entree', 'sortie', 'satisfaction_chaud']
  const [{ data: lien }, { data: qcmInfo }] = await Promise.all([
    supabase.from('qcm_sessions').select('id').eq('session_id', session_id).eq('qcm_id', qcm_id).limit(1).maybeSingle(),
    supabase.from('qcm').select('type').eq('id', qcm_id).maybeSingle(),
  ])
  if (!lien || !qcmInfo) return NextResponse.json({ error: 'Questionnaire introuvable pour cette session' }, { status: 404 })
  const typeQcm = String((qcmInfo as any).type || '')
  if (!TYPES_GRILLE.includes(typeQcm)) {
    return NextResponse.json({ error: 'Ce questionnaire ne se remplit pas depuis la grille.' }, { status: 422 })
  }
  const aujourdHui = new Date().toISOString().slice(0, 10)
  const commencee = !!(sess as any).date_debut && String((sess as any).date_debut).slice(0, 10) <= aujourdHui
  const finie = (sess as any).date_fin ? String((sess as any).date_fin).slice(0, 10) < aujourdHui : commencee
  if (['positionnement', 'entree'].includes(typeQcm) && !commencee) {
    return NextResponse.json({ error: 'Le positionnement se remplit à partir du premier jour de la session.' }, { status: 422 })
  }
  if (['sortie', 'satisfaction_chaud'].includes(typeQcm) && !finie) {
    return NextResponse.json({ error: "L'évaluation des acquis et la satisfaction se remplissent une fois la session terminée." }, { status: 422 })
  }

  const faits: string[] = []
  const refus: { apprenant_id: string; raison: string }[] = []
  for (const [apprenantId, valeurs] of Object.entries(reponses as Record<string, Record<string, string>>)) {
    const remplies = Object.values(valeurs || {}).filter((v) => String(v || '').trim() !== '').length
    if (!remplies) { refus.push({ apprenant_id: apprenantId, raison: 'aucune réponse' }); continue }

    const { data: inscrit } = await supabase.from('inscriptions')
      .select('id').eq('session_id', session_id).eq('apprenant_id', apprenantId).maybeSingle()
    if (!inscrit) { refus.push({ apprenant_id: apprenantId, raison: 'non inscrit à cette session' }); continue }

    let { data: ligne } = await supabase.from('qcm_reponses')
      .select('id, is_complete').eq('session_id', session_id).eq('qcm_id', qcm_id)
      .eq('apprenant_id', apprenantId).maybeSingle()
    if (ligne?.is_complete) { refus.push({ apprenant_id: apprenantId, raison: 'déjà complété' }); continue }
    if (!ligne) {
      const { data: creee, error } = await supabase.from('qcm_reponses').insert({
        organization_id: (sess as any).organization_id,
        session_id, qcm_id, apprenant_id: apprenantId, is_complete: false,
      }).select('id, is_complete').single()
      if (error) { refus.push({ apprenant_id: apprenantId, raison: 'création impossible' }); continue }
      ligne = creee
    }
    const r = await enregistrerReponses(supabase, (ligne as any).id, qcm_id, valeurs)
    if (r.success) faits.push(apprenantId)
    else refus.push({ apprenant_id: apprenantId, raison: r.error || 'enregistrement impossible' })
  }

  return NextResponse.json({ enregistres: faits.length, apprenants: faits, refus })
}
