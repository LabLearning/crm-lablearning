import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { withDocumentLogo } from '@/lib/pdf/org-logo'
import { QuestionnairePapierPDF, type QuestionPapier } from '@/lib/pdf/questionnaire-papier-pdf'

export const dynamic = 'force-dynamic'

/**
 * Questionnaire vierge à imprimer, un exemplaire par stagiaire de la session.
 *
 * Le formateur mène l'entretien de positionnement ou l'évaluation des acquis
 * en tête-à-tête, sur papier. Il lui faut le document ; le CRM n'en conserve
 * ensuite que le résultat, la feuille remplie restant la pièce justificative
 * à déposer au dossier.
 *
 *   /api/pdf/questionnaire-papier?session=<uuid>&qcm=<uuid>
 *   &corrige=1 : le corrigé seul, réservé au formateur
 *
 * Les réponses d'une question de connaissances sont mélangées (dans la banque,
 * la bonne réponse est presque toujours la première) et repérées par une
 * lettre ; l'ordre est le même sur tous les exemplaires, pour un seul corrigé.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId

  const sessionId = req.nextUrl.searchParams.get('session') || ''
  const qcmId = req.nextUrl.searchParams.get('qcm') || ''
  if (!sessionId || !qcmId) {
    return NextResponse.json({ error: 'Session et questionnaire requis' }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()

  const [{ data: orgRow }, { data: sess }, { data: qcm }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    supabase.from('sessions')
      .select(`id, reference, intitule, date_debut, date_fin,
               formation:formation_id(intitule),
               client:client_id(raison_sociale, nom_commercial),
               formateur:formateur_id(prenom, nom)`)
      .eq('id', sessionId).eq('organization_id', orgId).maybeSingle(),
    supabase.from('qcm').select('id, titre, type')
      .eq('id', qcmId).eq('organization_id', orgId).maybeSingle(),
  ])

  if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  if (!qcm) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

  const [{ data: questions }, { data: inscriptions }] = await Promise.all([
    supabase.from('qcm_questions')
      .select('id, texte, type, section, position, choix:qcm_choix(texte, position, est_correct)')
      .eq('qcm_id', qcmId).order('position', { ascending: true }),
    supabase.from('inscriptions')
      .select('apprenant:apprenants(prenom, nom)')
      .eq('session_id', sessionId)
      .not('status', 'in', '("annule","abandonne")'),
  ])

  // Mélange stable : graine tirée de l'identifiant de la question
  const graine = (id: string) => { let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
  const melanger = <T,>(liste: T[], id: string): T[] => {
    const l = [...liste]; let x = graine(id) || 1
    for (let i = l.length - 1; i > 0; i--) { x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0; x = (x ^ (x >>> 13)) >>> 0; const j = x % (i + 1); [l[i], l[j]] = [l[j], l[i]] }
    return l
  }
  const lignes: QuestionPapier[] = (questions || []).map((q: any) => {
    const ordonnes = [...(q.choix || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    // Question de connaissances (une bonne réponse existe) : réponses mélangées
    const connaissance = ordonnes.some((c: any) => c.est_correct) && ordonnes.length > 2
    const choix = connaissance ? melanger(ordonnes, String(q.id)) : ordonnes
    return {
      texte: q.texte,
      type: q.type,
      section: q.section,
      choix: choix.map((c: any) => c.texte),
      correctes: connaissance ? choix.map((c: any, i: number) => (c.est_correct ? i : -1)).filter((i: number) => i >= 0) : undefined,
    }
  })

  const stagiaires = (inscriptions || [])
    .map((i: any) => `${i.apprenant?.prenom || ''} ${i.apprenant?.nom || ''}`.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((nom) => ({ nom }))

  const s: any = sess
  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
  const dates = s.date_fin && s.date_fin !== s.date_debut
    ? `du ${jour(s.date_debut)} au ${jour(s.date_fin)}`
    : jour(s.date_debut)

  const org = await withDocumentLogo(supabase, orgRow)

  const buffer = await renderToBuffer(
    createElement(QuestionnairePapierPDF, {
      titre: (qcm as any).titre,
      type: (qcm as any).type,
      questions: lignes,
      stagiaires,
      session: {
        reference: s.reference || '',
        formation: s.formation?.intitule || s.intitule || '',
        client: s.client?.nom_commercial || s.client?.raison_sociale || '',
        formateur: s.formateur ? `${s.formateur.prenom || ''} ${s.formateur.nom || ''}`.trim() : '',
        dates,
      },
      org,
      editeLe: new Date().toLocaleDateString('fr-FR'),
      corrige: req.nextUrl.searchParams.get('corrige') === '1',
    }) as any,
  )

  const nomFichier = `${req.nextUrl.searchParams.get('corrige') === '1' ? 'Corrigé - ' : ''}${(qcm as any).titre} - ${s.reference || 'session'}`
    .replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_').slice(0, 90)

  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichier}.pdf"`,
    },
  })
}
