/**
 * Accès d'un compte franchise aux documents de son réseau.
 *
 * Les routes PDF servent l'équipe et, pour certains documents (attestations
 * d'hygiène, comptes rendus des formateurs), la franchise. Un compte franchise
 * est un utilisateur de l'organisation : sans ce contrôle, il pourrait ouvrir
 * le document de n'importe quelle session en devinant son identifiant.
 */

/** Franchise d'un compte de rôle « franchise », sinon null. */
export async function franchiseDuCompte(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('role, franchise_id').eq('id', userId).maybeSingle()
  return data?.role === 'franchise' ? data.franchise_id || null : null
}

/** La session appartient-elle à un établissement de la franchise ? */
export async function sessionDeLaFranchise(supabase: any, sessionId: string, franchiseId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from('sessions').select('client:client_id(franchise_id)')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  return (data as any)?.client?.franchise_id === franchiseId
}

/** Le parcours POEI appartient-il à un établissement de la franchise ? */
export async function poeiDeLaFranchise(supabase: any, poeiId: string, franchiseId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from('poei').select('client:client_id(franchise_id)')
    .eq('id', poeiId).eq('organization_id', orgId).maybeSingle()
  return (data as any)?.client?.franchise_id === franchiseId
}
