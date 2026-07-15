// Pont entre le compte formateur connecté (Supabase Auth) et son portail
// (pages sessions / émargement / apprenants) : résout le token actif du
// formateur, en le créant s'il n'existe pas encore.

export async function getFormateurPortalToken(
  supabase: any,
  orgId: string,
  userId: string,
  userEmail?: string | null,
): Promise<string | null> {
  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id, email')
    .eq('user_id', userId)
    .single()
  if (!formateur) return null

  const { data: tok } = await supabase
    .from('portal_access_tokens')
    .select('token')
    .eq('organization_id', orgId)
    .eq('type', 'formateur')
    .eq('formateur_id', formateur.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (tok?.token) return tok.token

  const { data: created } = await supabase
    .from('portal_access_tokens')
    .insert({
      organization_id: orgId,
      type: 'formateur',
      formateur_id: formateur.id,
      email: formateur.email || userEmail || null,
      created_by: userId,
    })
    .select('token')
    .single()
  return created?.token || null
}
