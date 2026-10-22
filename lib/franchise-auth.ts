import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { User, Organization } from '@/lib/types'

export interface Franchise {
  id: string
  nom: string
  raison_sociale: string | null
  secteur: string | null
  nombre_etablissements: number | null
  objectif_annuel_ca: number | null
  objectif_annuel_dossiers: number | null
  commission_type: string | null
  taux_commission: number | null
  logo_url: string | null
}

export interface FranchiseSession {
  user: User
  organization: Organization
  franchise: Franchise
  impersonatedBy?: User
}

/**
 * Contexte d'un utilisateur franchise (role='franchise', users.franchise_id).
 * Redirige vers /login si non connecté, /dashboard si pas le bon rôle.
 * Respecte l'impersonation (cookie ll_impersonate) : un super_admin peut
 * naviguer dans l'espace franchise en tant qu'un compte franchise.
 */
export async function getFranchiseSession(): Promise<FranchiseSession> {
  const anonClient = await createServerSupabaseClient()
  const { data: { user: authUser } } = await anonClient.auth.getUser()
  if (!authUser) redirect('/login')

  const supabase = await createServiceRoleClient()

  const { data: realUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!realUser) redirect('/login')
  // Un compte suspendu est déconnecté
  if (realUser.status === 'suspended') redirect('/auth/suspendu')

  // Impersonation : super_admin → compte franchise
  let user = realUser
  let impersonatedBy: User | undefined
  const impersonateCookie = (cookies() as any).get('ll_impersonate')
  if (impersonateCookie?.value && realUser.role === 'super_admin') {
    const { data: target } = await supabase
      .from('users')
      .select('*')
      .eq('id', impersonateCookie.value)
      .eq('organization_id', realUser.organization_id)
      .single()
    if (target?.role === 'franchise') {
      user = target
      impersonatedBy = realUser as User
    }
  }

  if (user.role !== 'franchise') redirect('/dashboard')
  if (!user.franchise_id) redirect('/login')

  const [{ data: organization }, { data: franchise }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', user.organization_id).single(),
    supabase
      .from('franchises')
      .select('id, nom, raison_sociale, secteur, nombre_etablissements, objectif_annuel_ca, objectif_annuel_dossiers, commission_type, taux_commission, logo_url')
      .eq('id', user.franchise_id)
      .single(),
  ])

  if (!organization || !franchise) redirect('/login')

  return {
    user: user as User,
    organization: organization as Organization,
    franchise: franchise as Franchise,
    impersonatedBy,
  }
}

export function franchiseDisplayName(f: Franchise): string {
  return f.nom || f.raison_sociale || 'Ma franchise'
}
