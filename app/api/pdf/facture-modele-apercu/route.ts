import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { getPortalContext } from '@/lib/portal-auth'
import { FactureFormateurPDF, type FactureModele } from '@/lib/pdf/facture-formateur-pdf'

/**
 * Aperçu d'un modèle de facture formateur avec des données d'exemple.
 * Accessible aux utilisateurs du dashboard (choix à la création) et au
 * formateur connecté / via token (choix depuis son espace Facturation).
 */
export async function GET(req: NextRequest) {
  // Autorisation : membre de l'org OU formateur (token portail)
  let orgId: string | null = null
  const token = req.nextUrl.searchParams.get('token')
  if (token) {
    const ctx = await getPortalContext(token)
    if (ctx && ctx.type === 'formateur') orgId = ctx.organization.id
  }
  if (!orgId) {
    const auth = await requireApiUser()
    if ('error' in auth) return auth.error
    orgId = auth.user.organizationId
  }

  const modele = (req.nextUrl.searchParams.get('modele') || 'epure') as FactureModele

  const supabase = await createServiceRoleClient()
  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const formateur = {
    civilite: 'M.', prenom: 'Jean', nom: 'Dupont',
    adresse: '12 rue des Écoles', code_postal: '75005', ville: 'Paris',
    siret: '123 456 789 00012', numero_da: '11 75 00000 75', email: 'jean.dupont@exemple.fr',
  }
  const facture = {
    numero: 'FF-2026-001', reference_externe: '2026-014',
    date_emission: null, created_at: new Date(2026, 0, 15).toISOString(),
    objet: 'Prestation de formation — Hygiène alimentaire (HACCP)',
    session: { reference: 'ADF_2026-014' },
    montant_ht: 1200, taux_tva: 0, montant_tva: 0, montant_ttc: 1200,
  }
  // Le détail d'exemple montre au formateur ce que portera chaque facture rattachée à une session
  const detail = {
    sessionId: 'exemple', reference: 'ADF_2026-014', formation: 'Hygiène alimentaire et prévention des risques (HACCP)',
    dateDebut: '2026-01-12', dateFin: '2026-01-14', periode: 'du 12 au 14 janvier 2026', jours: 3, heures: 21,
    clientId: null, client: 'Restaurant Le Comptoir', clientVille: 'Lyon', lieu: '8 rue de la République, 69002 Lyon',
    modalite: 'Présentiel', stagiaires: 6, prevu: 1200, tarifJour: 400, poei: false,
  }

  const buffer = await renderToBuffer(
    createElement(FactureFormateurPDF, { facture, formateur, org, modele, detail }) as any
  )
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="apercu-facture-${modele}.pdf"`,
      'Cache-Control': 'private, max-age=0',
    },
  })
}
