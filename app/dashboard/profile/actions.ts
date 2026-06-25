'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const first_name = (formData.get('first_name') as string)?.trim()
  const last_name = (formData.get('last_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!first_name || first_name.length < 2) {
    return { success: false, error: 'Le prénom doit contenir au moins 2 caractères' }
  }
  if (!last_name || last_name.length < 2) {
    return { success: false, error: 'Le nom doit contenir au moins 2 caractères' }
  }

  const { error } = await supabase
    .from('users')
    .update({ first_name, last_name, phone: phone || null })
    .eq('id', session.user.id)

  if (error) {
    return { success: false, error: 'Erreur lors de la mise à jour du profil' }
  }

  await logAudit({
    action: 'update_profile',
    entity_type: 'user',
    entity_id: session.user.id,
  })

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

// Choisir un avatar préfait (URL d'avatar généré) — supprime d'abord
// une éventuelle photo uploadée dans notre bucket pour ne pas la laisser orpheline.
export async function setAvatarAction(url: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  if (!url || !/^https:\/\//.test(url)) {
    return { success: false, error: 'Avatar invalide' }
  }

  const { data: me } = await supabase.from('users').select('avatar_url').eq('id', session.user.id).single()
  const old = me?.avatar_url as string | null
  if (old) {
    const path = old.split('/organisation/')[1]
    if (path && path.startsWith('avatars/')) await supabase.storage.from('organisation').remove([path])
  }

  const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', session.user.id)
  if (error) return { success: false, error: "Erreur lors de l'enregistrement de l'avatar" }

  await logAudit({ action: 'update_avatar', entity_type: 'user', entity_id: session.user.id })
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
