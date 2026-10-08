import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { CERTIFICAT_SIGNATURE_CONVENTION } from '@/lib/fonctionnalites'
import { construirePreuveSignatureConvention } from '@/lib/certificat-signature-convention'
import { CertificatSignatureConventionPDF } from '@/lib/pdf/certificat-signature-convention-pdf'

/**
 * Certificat de signature électronique d'une convention (dossier de preuve).
 * Il ne se délivre que pour une convention signée électroniquement par le
 * client, et ne présente que les preuves réellement enregistrées : jamais la
 * date portée sur la convention, toujours l'horodatage réel de la signature.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!CERTIFICAT_SIGNATURE_CONVENTION) {
    return NextResponse.json({ error: 'Le certificat de signature est désactivé.' }, { status: 404 })
  }
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error
  const orgId = auth.user.organizationId
  const supabase = await createServiceRoleClient()

  // Le certificat porte l'IP, le navigateur et la signature du client : mêmes
  // droits que la page Conventions, selon les permissions de l'organisation
  const { data: permissions } = await supabase.from('permissions').select('*')
    .eq('organization_id', orgId).eq('role', auth.user.role)
  const { checkDashboardAccess } = await import('@/lib/dashboard-guard')
  if (!checkDashboardAccess('/dashboard/conventions', auth.user.role as any, (permissions || []) as any).allowed) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const dossier = await construirePreuveSignatureConvention(supabase, orgId, params.id)
  if (!dossier.ok) return NextResponse.json({ error: dossier.error }, { status: dossier.status })
  const { preuve, org, numero } = dossier

  const buffer = await renderToBuffer(createElement(CertificatSignatureConventionPDF, { preuve, org }) as any)
  // Chaque tirage est tracé : le certificat porte l'adresse IP et la signature du client
  await logAudit({
    action: 'emettre_certificat_signature', entity_type: 'convention', entity_id: params.id,
    details: { numero, empreinte: preuve.empreinteDossier },
  })
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificat-signature-${numero || params.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
