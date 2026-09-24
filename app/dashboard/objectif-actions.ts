'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { ROLES_OBJECTIF } from '@/lib/objectif-mois'

/**
 * Fixe l'objectif d'établissements à former pour un mois (« 2026-10 »).
 * Réservé à la direction ; tracé dans le journal d'audit.
 */
export async function setObjectifMoisAction(mois: string, etablissements: number): Promise<ActionResult<{ objectif: number }>> {
  const session = await getSession()
  if (!ROLES_OBJECTIF.includes(session.user.role)) return { success: false, error: 'Réservé à la direction' }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return { success: false, error: 'Mois invalide' }
  const n = Math.round(Number(etablissements))
  if (!Number.isFinite(n) || n < 1 || n > 1000) return { success: false, error: 'L’objectif doit être compris entre 1 et 1 000 établissements' }

  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('objectifs_formation').upsert({
    organization_id: session.organization.id,
    mois: `${mois}-01`,
    etablissements: n,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,mois' })
  if (error) {
    if (/objectifs_formation|42P01|PGRST205/i.test(`${error.code} ${error.message}`)) {
      return { success: false, error: 'La table des objectifs n’existe pas encore : appliquez la migration 158.' }
    }
    return { success: false, error: error.message }
  }

  await logAudit({ action: 'objectif_mois', entity_type: 'organization', entity_id: session.organization.id, details: { mois, etablissements: n } })
  revalidatePath('/dashboard')
  return { success: true, data: { objectif: n } }
}
