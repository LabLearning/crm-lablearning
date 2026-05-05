import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

/** Endpoint debug : retourne ce que voit le user connecté pour les formations */
export async function GET() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formations, error: errFormations } = await supabase
    .from('formations')
    .select('id, intitule, is_active, organization_id')
    .eq('organization_id', session.organization.id)
    .eq('is_active', true)
    .order('intitule')

  const { data: allFormations } = await supabase
    .from('formations')
    .select('id, intitule, is_active, organization_id')

  return NextResponse.json({
    user: { id: session.user.id, email: session.user.email, role: session.user.role },
    organization: { id: session.organization.id, name: session.organization.name },
    formations_visible_with_filter: formations?.length || 0,
    formations_list: (formations || []).map(f => f.intitule),
    error_filter: errFormations?.message || null,
    formations_total_in_db: allFormations?.length || 0,
    formations_other_orgs: (allFormations || []).filter(f => f.organization_id !== session.organization.id).length,
  })
}
