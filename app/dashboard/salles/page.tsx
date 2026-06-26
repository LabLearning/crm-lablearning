import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SallesList } from './SallesList'

export const dynamic = 'force-dynamic'

export default async function SallesPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: salles } = await supabase
    .from('salles_formation')
    .select('*')
    .eq('organization_id', session.organization.id)
    .order('intitule', { ascending: true })

  return (
    <div className="animate-fade-in">
      <SallesList salles={(salles || []) as any[]} />
    </div>
  )
}
