'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { peutGererSessions } from '@/lib/sessions-acces'
import type { ActionResult } from '@/lib/types'

/** Affecte un formateur à une session qui n'en avait pas (écran de rattrapage). */
export async function assignerFormateurAction(sessionId: string, formateurId: string): Promise<ActionResult> {
  const session = await getSession()
  // Joignable hors du tableau de bord comme toute action exportée : personnel qui gère les sessions seulement
  if (!peutGererSessions(session, 'update')) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  // Un formateur d'un autre organisme ne s'enregistre jamais tel quel (client de service, sans RLS)
  const { data: formateur } = await supabase.from('formateurs')
    .select('id').eq('id', formateurId).eq('organization_id', session.organization.id).maybeSingle()
  if (!formateur) return { success: false, error: 'Formateur introuvable' }

  const { error } = await supabase.from('sessions')
    .update({ formateur_id: formateurId, updated_at: new Date().toISOString() })
    .eq('id', sessionId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur lors de l\'affectation' }

  await logAudit({ action: 'assign_formateur', entity_type: 'session', entity_id: sessionId, details: { formateur_id: formateurId } })
  revalidatePath('/dashboard/sessions/sans-formateur')
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}
