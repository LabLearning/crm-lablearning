/**
 * Qui prévenir d'une demande entrante (site, Meta, Google Ads) : l'équipe
 * commerciale active. Pour un client déjà connu, seulement les responsables
 * et le commercial qui suit ce client : un commercial ne voit que les clients
 * de son portefeuille. Même règle pour la page Contact, les modèles gratuits
 * et le rappel Starkk.
 */
const ROLES_ALERTES = ['super_admin', 'directeur_commercial', 'commercial']

export async function equipeAPrevenir(supabase: any, orgId: string, clientId: string | null): Promise<string[]> {
  const { data } = await supabase.from('users').select('id, role')
    .eq('organization_id', orgId).eq('status', 'active').in('role', ROLES_ALERTES)
  let equipe = ((data || []) as { id: string; role: string }[])
  if (clientId && equipe.some((u) => u.role === 'commercial')) {
    // Portefeuille, comme la fiche client : le commercial du client, et celui qui suit un lead converti vers lui
    const [{ data: cl }, { data: leads }] = await Promise.all([
      supabase.from('clients').select('assigned_to').eq('id', clientId).eq('organization_id', orgId).maybeSingle(),
      supabase.from('leads').select('assigned_to').eq('organization_id', orgId).eq('converted_client_id', clientId).not('assigned_to', 'is', null),
    ])
    const suivent = new Set([cl?.assigned_to, ...((leads || []) as any[]).map((l) => l.assigned_to)].filter(Boolean))
    equipe = equipe.filter((u) => u.role !== 'commercial' || suivent.has(u.id))
  }
  return equipe.map((u) => u.id)
}
