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

/**
 * Fixe l'objectif de chiffre d'affaires HT d'un mois (« 2026-10 »).
 * La ligne du mois garde son objectif d'établissements ; s'il n'a jamais été
 * saisi il reste vide, c'est-à-dire « par défaut » (25).
 */
export async function setObjectifCaMoisAction(mois: string, caHt: number): Promise<ActionResult<{ objectifCa: number }>> {
  const session = await getSession()
  if (!ROLES_OBJECTIF.includes(session.user.role)) return { success: false, error: 'Réservé à la direction' }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return { success: false, error: 'Mois invalide' }
  const ca = Math.round(Number(caHt))
  if (!Number.isFinite(ca) || ca < 1 || ca > 10_000_000) return { success: false, error: 'L’objectif de chiffre d’affaires doit être compris entre 1\u202f€ et 10\u202f000\u202f000\u202f€' }

  const supabase = await createServiceRoleClient()
  const { data: existant, error: eLecture } = await supabase.from('objectifs_formation').select('etablissements')
    .eq('organization_id', session.organization.id).eq('mois', `${mois}-01`).maybeSingle()
  const manque = (e: any) => e && /objectifs_formation|ca_ht|42P01|42703|PGRST205|PGRST204/i.test(`${e.code} ${e.message}`)
  if (manque(eLecture)) return { success: false, error: 'La table des objectifs n’est pas à jour : appliquez les migrations 158 et 159.' }
  if (eLecture) return { success: false, error: eLecture.message }

  const { error } = await supabase.from('objectifs_formation').upsert({
    organization_id: session.organization.id,
    mois: `${mois}-01`,
    etablissements: (existant as any)?.etablissements ?? null,
    ca_ht: ca,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,mois' })
  if (error) {
    if (manque(error)) return { success: false, error: 'La table des objectifs n’est pas à jour : appliquez les migrations 158 et 159.' }
    return { success: false, error: error.message }
  }

  await logAudit({ action: 'objectif_ca_mois', entity_type: 'organization', entity_id: session.organization.id, details: { mois, ca_ht: ca } })
  revalidatePath('/dashboard')
  return { success: true, data: { objectifCa: ca } }
}
