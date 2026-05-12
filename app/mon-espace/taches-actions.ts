'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { maybeDebloquerFacturation } from '@/lib/taches-formateur'
import type { ActionResult } from '@/lib/types'

export async function toggleTacheAction(tacheId: string, complete: boolean, notes?: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Vérifier que le user est bien le formateur de la tâche
  const { data: formateur } = await supabase
    .from('formateurs').select('id').eq('user_id', session.user.id).maybeSingle()
  if (!formateur) return { success: false, error: 'Compte formateur introuvable' }

  const { data: tache } = await supabase
    .from('taches_formateur')
    .select('id, session_id, formateur_id, organization_id, type, libelle, bloque_facturation')
    .eq('id', tacheId)
    .single()
  if (!tache) return { success: false, error: 'Tâche introuvable' }
  if (tache.formateur_id !== formateur.id) return { success: false, error: 'Cette tâche ne vous est pas assignée' }

  const updates: Record<string, unknown> = {
    complete,
    date_completion: complete ? new Date().toISOString() : null,
  }
  if (notes !== undefined) updates.notes = notes

  const { error } = await supabase
    .from('taches_formateur')
    .update(updates)
    .eq('id', tacheId)
  if (error) return { success: false, error: error.message }

  // Si la tâche est bloquante et qu'on vient de la valider → check déblocage facturation
  let debloque = false
  if (complete && tache.bloque_facturation) {
    debloque = await maybeDebloquerFacturation(supabase, tache.session_id, tache.organization_id)
  }

  await logAudit({
    action: complete ? 'complete_tache' : 'uncomplete_tache',
    entity_type: 'tache_formateur',
    entity_id: tacheId,
    details: { type: tache.type, libelle: tache.libelle, debloque_facturation: debloque },
  })
  revalidatePath('/mon-espace')
  return { success: true, data: { debloque } }
}
