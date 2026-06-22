import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PoeiList } from './PoeiList'
import type { Poei } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: poei } = await supabase
    .from('poei')
    .select(`
      *,
      client:clients(raison_sociale),
      formation:formations(intitule),
      session:sessions(reference, date_debut, date_fin)
    `)
    .eq('organization_id', session.organization.id)
    .order('created_at', { ascending: false })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, raison_sociale')
    .eq('organization_id', session.organization.id)
    .order('raison_sociale')

  const { data: formations } = await supabase
    .from('formations')
    .select('id, intitule')
    .eq('organization_id', session.organization.id)
    .eq('is_active', true)
    .order('intitule')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, intitule, reference, date_debut, ville')
    .eq('organization_id', session.organization.id)
    .order('date_debut', { ascending: false })
    .limit(300)

  return (
    <div className="animate-fade-in">
      <PoeiList
        poei={(poei || []) as Poei[]}
        clients={clients || []}
        formations={formations || []}
        sessions={(sessions || []) as any[]}
      />
    </div>
  )
}
