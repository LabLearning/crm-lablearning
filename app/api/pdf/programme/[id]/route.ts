import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/api-auth'
import { ProgrammeFormationPDF } from '@/lib/pdf/programme-formation-pdf'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser()
  if ('error' in auth) return auth.error

  const supabase = await createServiceRoleClient()

  // Contrôle d'org : la formation doit appartenir à l'organisation de l'appelant.
  const { data: formation } = await supabase.from('formations').select('*').eq('id', params.id).eq('organization_id', auth.user.organizationId).single()
  if (!formation) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })

  // Programme générique, ou contextualisé à une session (?session=<id>) :
  // on ajoute alors une section « Organisation » avec dates / horaires / lieu.
  let session: any = null
  const sessionId = new URL(req.url).searchParams.get('session')
  if (sessionId) {
    const { data } = await supabase
      .from('sessions')
      .select('reference, date_debut, date_fin, horaires_jours, lieu, adresse, code_postal, ville, modalite, formateur:formateurs(prenom, nom)')
      .eq('id', sessionId)
      .single()
    session = data
  }

  const { data: orgRaw } = await supabase.from('organizations').select('*').eq('id', formation.organization_id).single()
  const { withDocumentLogo } = await import('@/lib/pdf/org-logo')
  const org = await withDocumentLogo(supabase, orgRaw)

  const buffer = await renderToBuffer(createElement(ProgrammeFormationPDF, { formation, org, session }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="programme-${formation.reference || 'formation'}.pdf"`,
    },
  })
}
