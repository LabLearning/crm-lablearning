import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { definirActeur } from '@/lib/acteur'
import type { User, Organization } from '@/lib/types'
import type { ApporteurAffaires } from '@/lib/types/crm'

export interface ApporteurSession {
  user: User
  organization: Organization
  /** Fiche apporteur liée au compte (apporteurs_affaires.user_id) ; null si aucune. */
  apporteur: (ApporteurAffaires & { nom_enseigne?: string | null; categorie?: string | null; user_id?: string | null }) | null
  impersonatedBy?: User
}

/**
 * Contexte d'un compte apporteur d'affaires (role='apporteur_affaires').
 * Redirige vers /login si non connecté, /dashboard si ce n'est pas le bon rôle.
 * Respecte l'aperçu administrateur (cookie ll_impersonate) : un super_admin
 * peut parcourir l'espace d'un apporteur pour vérifier ce qu'il voit.
 */
export async function getApporteurSession(): Promise<ApporteurSession> {
  const anonClient = await createServerSupabaseClient()
  const { data: { user: authUser } } = await anonClient.auth.getUser()
  if (!authUser) redirect('/login')

  const supabase = await createServiceRoleClient()
  const { data: realUser } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!realUser) redirect('/login')

  let user = realUser
  let impersonatedBy: User | undefined
  const impersonateCookie = (cookies() as any).get('ll_impersonate')
  if (impersonateCookie?.value && realUser.role === 'super_admin') {
    const { data: target } = await supabase.from('users').select('*')
      .eq('id', impersonateCookie.value).eq('organization_id', realUser.organization_id).single()
    if (target?.role === 'apporteur_affaires') {
      user = target
      impersonatedBy = realUser as User
    }
  }

  if (user.role !== 'apporteur_affaires') redirect('/dashboard')
  definirActeur(user.id, impersonatedBy?.id || null)

  const [{ data: organization }, { data: apporteur }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', user.organization_id).single(),
    supabase.from('apporteurs_affaires').select('*').eq('user_id', user.id).eq('organization_id', user.organization_id).maybeSingle(),
  ])
  if (!organization) redirect('/login')

  return {
    user: user as User,
    organization: organization as Organization,
    apporteur: (apporteur as any) || null,
    impersonatedBy,
  }
}
