import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { getPortalContext } from '@/lib/portal-auth'
import { FactureFormateurPDF, type FactureModele } from '@/lib/pdf/facture-formateur-pdf'
import { SESSION_DETAIL_SELECT, chargerDetailsPrestations } from '@/lib/facture-formateur-detail'

/**
 * PDF d'une facture de prestation formateur. Accessible :
 *  - au formateur propriétaire (via ?token=<portail> ou compte connecté),
 *  - à un utilisateur du dashboard de la même organisation.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceRoleClient()

  const { data: facture } = await supabase
    .from('factures_formateur')
    .select(`*, formateur:formateur_id(civilite, prenom, nom, email, adresse, code_postal, ville, siret, numero_da, facture_modele), ${SESSION_DETAIL_SELECT}`)
    .eq('id', params.id)
    .single()
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  // Autorisation — le formateur propriétaire OU un membre de l'org
  let authorized = false
  const token = req.nextUrl.searchParams.get('token')
  if (token) {
    const ctx = await getPortalContext(token)
    if (ctx && ctx.type === 'formateur' && ctx.formateur.id === (facture as any).formateur_id) authorized = true
  }
  if (!authorized) {
    const auth = await requireApiUser()
    if (!('error' in auth) && auth.user.organizationId === (facture as any).organization_id) authorized = true
  }
  if (!authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: orgRaw } = await supabase
    .from('organizations').select('*').eq('id', (facture as any).organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  // Modèle : override ?modele= (aperçu) sinon le choix enregistré du formateur
  const override = req.nextUrl.searchParams.get('modele') as FactureModele | null
  const modele = (override || (facture as any).formateur?.facture_modele || 'epure') as FactureModele

  // Le détail de la prestation (formation, dates, client, lieu) vient de la session rattachée
  const detail = (await chargerDetailsPrestations(supabase, [facture]))[(facture as any).id] || null

  const buffer = await renderToBuffer(
    createElement(FactureFormateurPDF, { facture, formateur: (facture as any).formateur, org, modele, detail }) as any
  )
  const numAffiche = (facture as any).reference_externe || (facture as any).numero

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${numAffiche}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
