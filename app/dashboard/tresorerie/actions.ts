'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getSession } from '@/lib/auth'
import { TAG_QONTO } from '@/lib/qonto'
import { peutVoirTresorerie } from '@/lib/tresorerie'

/** Relit Qonto tout de suite, sans attendre la fin des cinq minutes de cache. */
export async function rafraichirTresorerieAction(): Promise<void> {
  const session = await getSession()
  if (!peutVoirTresorerie(session.user.role)) return
  revalidateTag(TAG_QONTO)
  revalidatePath('/dashboard/tresorerie')
}
