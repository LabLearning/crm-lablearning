import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Sortie d'un compte suspendu : la session est fermée sur tous ses appareils,
 * puis la page de connexion explique pourquoi. Un compte actif qui arrive ici
 * n'est pas déconnecté (un lien piégé ne peut pas couper la session d'autrui).
 */
export async function GET(request: Request) {
  const anonClient = await createServerSupabaseClient()
  const { data: { user: authUser } } = await anonClient.auth.getUser()
  if (!authUser) return NextResponse.redirect(new URL('/login', request.url))

  const supabase = await createServiceRoleClient()
  const { data: profil } = await supabase.from('users').select('status').eq('id', authUser.id).maybeSingle()
  if (profil?.status !== 'suspended') return NextResponse.redirect(new URL('/dashboard', request.url))

  await anonClient.auth.signOut()
  return NextResponse.redirect(new URL('/login?suspendu=1', request.url))
}
