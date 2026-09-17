import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { QUESTIONS_FORMATEUR } from '@/lib/evaluation-formateur-referent'
import { EvaluationFormateurReferentPDF } from '@/lib/pdf/evaluation-formateur-referent-pdf'

export const dynamic = 'force-dynamic'

/**
 * Avis du référent de l'établissement sur un formateur, en PDF.
 *
 *   /api/pdf/evaluation-formateur-referent/<appréciation>
 *
 * L'identifiant est celui de la ligne d'appréciation (type
 * evaluation_formateur) : une par formateur et par parcours.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()

  const { data: a } = await supabase
    .from('appreciations_parties_prenantes')
    .select(`
      *,
      formateur:formateur_id(prenom, nom),
      client:client_id(raison_sociale, nom_commercial),
      poei:poei_id(numero, date_debut, date_fin, formation:formation_id(intitule)),
      session:session_id(reference, intitule, date_debut, date_fin, formation:formation_id(intitule))
    `)
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!a) return NextResponse.json({ error: 'Évaluation introuvable' }, { status: 404 })
  if ((a as any).type !== 'evaluation_formateur') {
    return NextResponse.json({ error: "Cette appréciation n'est pas une évaluation de formateur" }, { status: 400 })
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const f: any = (a as any).formateur
  const formateurNom = f ? `${f.prenom || ''} ${f.nom || ''}`.trim() : 'Formateur'
  const cl: any = (a as any).client
  const poei: any = (a as any).poei
  const sess: any = (a as any).session
  const intervention = poei
    ? { libelle: `Parcours ${poei.numero || 'POEI'}${poei.formation?.intitule ? `, ${poei.formation.intitule}` : ''}`.trim(), dateDebut: poei.date_debut, dateFin: poei.date_fin }
    : sess
      ? { libelle: `${sess.reference ? `Session ${sess.reference}` : 'Session'}${sess.formation?.intitule || sess.intitule ? `, ${sess.formation?.intitule || sess.intitule}` : ''}`, dateDebut: sess.date_debut, dateFin: sess.date_fin }
      : null

  const notes: Record<string, number | null> = {}
  for (const q of QUESTIONS_FORMATEUR) notes[q.cle] = (a as any)[q.cle] != null ? Number((a as any)[q.cle]) : null

  const numero = `EVF-${(poei?.numero || sess?.reference || String(params.id).slice(0, 8)).replace(/[^A-Za-z0-9-]/g, '')}-${String(params.id).slice(0, 4).toUpperCase()}`

  const buffer = await renderToBuffer(
    createElement(EvaluationFormateurReferentPDF, {
      org, numero, formateurNom,
      etablissement: cl?.nom_commercial || cl?.raison_sociale || null,
      intervention,
      referent: { nom: (a as any).repondant_nom || null, fonction: (a as any).repondant_fonction || null, email: (a as any).repondant_email || null },
      notes,
      noteGlobale: (a as any).note_globale != null ? Number((a as any).note_globale) : null,
      recommande: (a as any).recommande ?? null,
      commentaire: (a as any).commentaire || null,
      envoyeLe: (a as any).sent_at || (a as any).created_at || null,
      reponduLe: (a as any).repondu_at || null,
    }) as any,
  )

  const nom = `Evaluation formateur - ${formateurNom}${cl ? ` - ${cl.nom_commercial || cl.raison_sociale}` : ''}`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_')}.pdf"`,
    },
  })
}
