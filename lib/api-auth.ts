import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Authentification pour les routes API (App Router).
 *
 * Contrairement à `getSession()`, ne redirige pas (une route API doit renvoyer
 * un JSON 401, pas un 307 vers /login) et expose l'`organizationId` et le
 * `role` de l'appelant — indispensables pour empêcher un utilisateur de
 * télécharger le document d'une autre organisation en devinant un UUID.
 */
export interface ApiUser {
  id: string
  organizationId: string
  role: string
  email: string | null
}

/**
 * Retourne l'utilisateur authentifié résolu (avec son organisation et son
 * rôle), ou une réponse 401 prête à renvoyer.
 */
export async function requireApiUser(): Promise<
  { user: ApiUser } | { error: NextResponse }
> {
  const anonClient = await createServerSupabaseClient()
  const { data: { user: authUser } } = await anonClient.auth.getUser()
  if (!authUser) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }

  const supabase = await createServiceRoleClient()
  const { data: u } = await supabase
    .from('users')
    .select('id, organization_id, role, email, status')
    .eq('id', authUser.id)
    .single()

  if (!u || u.status !== 'active') {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }

  return {
    user: { id: u.id, organizationId: u.organization_id, role: u.role, email: u.email },
  }
}
