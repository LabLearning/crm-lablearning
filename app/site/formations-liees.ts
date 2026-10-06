import { createServiceRoleClient } from '@/lib/supabase/server'

const ORG = 'ff747dfe-c034-44d8-98d7-e53892263fb5'

/**
 * Formations publiées dont l'intitulé correspond à un sujet (expression
 * régulière sans les barres). Sert aux guides et aux modèles gratuits.
 */
export async function formationsLiees(motif: string): Promise<{ id: string; intitule: string; duree_heures: number | null }[]> {
  if (!motif) return []
  try {
    const supabase = await createServiceRoleClient()
    const { data } = await supabase.from('formations')
      .select('id, intitule, duree_heures')
      .eq('organization_id', ORG).eq('is_active', true).eq('site_publie', true).not('is_poei', 'is', true)
      .order('intitule').limit(200)
    const re = new RegExp(motif, 'i')
    return ((data || []) as any[]).filter((f) => re.test(String(f.intitule || ''))).slice(0, 3)
  } catch {
    // Sans base joignable, la page s'affiche sans ce bloc
    return []
  }
}
