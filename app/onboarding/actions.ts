'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

// Sauvegarde légère de l'onboarding : nom de l'espace (org) + identité (user).
export async function saveOnboardingAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const name = ((formData.get('name') as string) || '').trim()
  const prenom = ((formData.get('prenom') as string) || '').trim()
  const nom = ((formData.get('nom') as string) || '').trim()

  if (name) {
    await supabase.from('organizations').update({ name }).eq('id', session.organization.id)
  }
  const userUpdate: Record<string, string> = {}
  if (prenom) userUpdate.first_name = prenom
  if (nom) userUpdate.last_name = nom
  if (Object.keys(userUpdate).length > 0) {
    await supabase.from('users').update(userUpdate).eq('id', session.user.id)
  }

  revalidatePath('/dashboard')
  return { success: true }
}
