import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PoeiList } from './PoeiList'
import type { Poei } from '@/lib/types/poei'

export const dynamic = 'force-dynamic'

export default async function PoeiPage() {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const [{ data: poeiRaw }, { data: clients }, { data: formationsPoei }] = await Promise.all([
    supabase
      .from('poei')
      .select(`
        *,
        client:clients(raison_sociale),
        formation:formations(intitule),
        session:sessions(reference, date_debut, date_fin),
        candidats:poei_candidats(id)
      `)
      .eq('organization_id', session.organization.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, raison_sociale')
      .eq('organization_id', session.organization.id)
      .order('raison_sociale'),
    // Catalogue : on ne propose que les formations marquées POEI (fallback : toutes si aucune)
    supabase
      .from('formations')
      .select('id, intitule, duree_heures, is_poei')
      .eq('organization_id', session.organization.id)
      .eq('is_active', true)
      .order('intitule'),
  ])

  const poei = (poeiRaw || []).map((p: any) => ({ ...p, candidats_count: (p.candidats || []).length })) as Poei[]

  const onlyPoei = (formationsPoei || []).filter((f: any) => f.is_poei)
  const formations = (onlyPoei.length > 0 ? onlyPoei : (formationsPoei || [])) as any[]

  return (
    <div className="animate-fade-in">
      <PoeiList
        poei={poei}
        clients={clients || []}
        formations={formations}
        hasPoeiCatalog={onlyPoei.length > 0}
      />
    </div>
  )
}
