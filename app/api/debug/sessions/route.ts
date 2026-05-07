import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: full, error: errFull } = await supabase
    .from('sessions')
    .select(`
      *,
      formation:formations(intitule, reference, modalite, duree_heures),
      formateur:formateurs(prenom, nom)
    `)
    .eq('organization_id', session.organization.id)
    .order('date_debut', { ascending: false })

  const { data: simple, error: errSimple } = await supabase
    .from('sessions')
    .select('id, reference, status, date_debut, formation_id')
    .eq('organization_id', session.organization.id)

  return NextResponse.json({
    user: session.user.email,
    org: session.organization.id,
    full_query_count: full?.length ?? null,
    full_query_error: errFull?.message || null,
    simple_query_count: simple?.length ?? null,
    simple_query_error: errSimple?.message || null,
    samples: (full || simple || []).slice(0, 3).map(s => ({
      id: s.id, reference: s.reference, status: s.status, date_debut: s.date_debut,
    })),
  })
}
