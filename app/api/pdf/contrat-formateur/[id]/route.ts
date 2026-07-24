import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ContratFormateurPDF } from '@/lib/pdf/contrat-formateur-pdf'

export const dynamic = 'force-dynamic'

/**
 * Rend le contrat de prestation d'un formateur.
 *
 * `[id]` = identifiant du formateur. Le contrat effectif est désigné par :
 *   ?contrat=<id>       → contrat en base : rend la version SIGNÉE (signatures apposées)
 *   ?session=<id>       → projection pour une session (aperçu avant création du contrat)
 *   ?intervention=<id>  → projection pour une intervention POEI
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { searchParams } = new URL(req.url)

  const { data: formateur } = await supabase.from('formateurs').select('*').eq('id', params.id).single()
  if (!formateur) return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })

  // ── Contrôle d'accès ──
  // Le contrat porte des données personnelles et une signature : il n'est
  // accessible qu'aux membres de l'organisation du formateur, et un formateur
  // ne peut consulter que ses propres contrats.
  const { data: me } = await supabase
    .from('users').select('id, role, organization_id').eq('id', user.id).single()
  if (!me || me.organization_id !== formateur.organization_id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  if (me.role === 'formateur' && formateur.user_id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', formateur.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const contratId = searchParams.get('contrat')
  let sessionId = searchParams.get('session')
  let interventionId = searchParams.get('intervention')
  let contrat: any = null

  if (contratId) {
    const { data } = await supabase
      .from('contrats_formateur').select('*').eq('id', contratId).single()
    // Le contrat doit bien porter sur le formateur demandé
    if (!data || data.formateur_id !== formateur.id) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    }
    contrat = data
    sessionId = data.session_id || sessionId
    interventionId = data.poei_intervention_id || interventionId

    // Un contrat signé est figé : on sert l'exemplaire archivé, jamais un
    // nouveau rendu — le gabarit peut avoir changé depuis la signature.
    if (contrat.storage_path) {
      const { data: signed } = await supabase.storage
        .from('documents')
        .createSignedUrl(contrat.storage_path, 60)
      if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl)
    }
  }

  let session: any = null
  if (sessionId) {
    const { data } = await supabase
      .from('sessions')
      .select('*, formation:formation_id(intitule, duree_heures, reference, sous_titre, objectifs_pedagogiques, programme_detaille, prerequis, public_vise, methodes_pedagogiques, moyens_techniques, modalites_evaluation)')
      .eq('id', sessionId).single()
    session = data
  }

  let intervention: any = null
  if (!session && interventionId) {
    const { data } = await supabase
      .from('poei_interventions')
      .select('*, poei:poei(numero, formation:formations(intitule, reference, sous_titre, objectifs_pedagogiques, programme_detaille, prerequis, public_vise, methodes_pedagogiques, moyens_techniques, modalites_evaluation), client:clients(raison_sociale))')
      .eq('id', interventionId).single()
    intervention = data
  }

  const buffer = await renderToBuffer(
    createElement(ContratFormateurPDF, { formateur, org, session, contrat, intervention }) as any,
  )

  // ?inline=1 → affichage dans le navigateur (aperçu), sinon téléchargement
  const inline = searchParams.get('inline') === '1'
  const suffixe = contrat?.signature_formateur_date ? '-signe' : ''
  const nomFichier = `contrat-prestation-${formateur.nom}${suffixe}.pdf`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${nomFichier}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
