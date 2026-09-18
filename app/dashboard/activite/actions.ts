'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

const ROLES_JOURNAL = ['super_admin', 'gestionnaire']
const ROLES_ANNULATION = ['super_admin']

/**
 * Annule une activité du journal : remet la ligne dans l'état d'avant.
 *
 * - modification : les colonnes touchées reprennent leur valeur d'avant ;
 * - création : la ligne créée est supprimée ;
 * - suppression : la ligne est recréée telle qu'elle était.
 *
 * L'annulation est elle-même une écriture : le déclencheur la journalise au
 * nom de la personne qui annule. Réservée au super administrateur, parce
 * qu'elle défait le travail de quelqu'un d'autre.
 */
export async function annulerActiviteAction(activiteId: string): Promise<ActionResult<{ avertissement?: string }>> {
  const session = await getSession()
  if (!ROLES_ANNULATION.includes(session.user.role)) return { success: false, error: 'Seul un super administrateur peut annuler une activité' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: a, error } = await supabase.from('activites').select('*')
    .eq('id', activiteId).eq('organization_id', orgId).maybeSingle()
  if (error) return { success: false, error: 'Journal indisponible : appliquer la migration 155_journal_activite.sql' }
  if (!a) return { success: false, error: 'Activité introuvable' }
  if (a.annulee_le) return { success: false, error: 'Cette activité a déjà été annulée' }
  if (!a.record_id) return { success: false, error: 'Ligne sans identifiant : annulation impossible' }

  const table = a.table_name as string
  const champs = (a.champs || []) as string[]
  const avant = (a.avant || null) as Record<string, unknown> | null
  const apres = (a.apres || null) as Record<string, unknown> | null

  // Des modifications plus récentes sur la même ligne : on prévient, on n'empêche pas
  const { count: plusRecentes } = await supabase.from('activites')
    .select('id', { count: 'exact', head: true })
    .eq('table_name', table).eq('record_id', a.record_id).gt('created_at', a.created_at).is('annulee_le', null)
  const avertissement = (plusRecentes || 0) > 0
    ? `${plusRecentes} modification${(plusRecentes || 0) > 1 ? 's' : ''} plus récente${(plusRecentes || 0) > 1 ? 's' : ''} sur cette ligne ${(plusRecentes || 0) > 1 ? 'ont été conservées' : 'a été conservée'}.`
    : undefined

  let echec: string | null = null
  if (a.operation === 'update') {
    if (!avant) return { success: false, error: "État d'avant inconnu" }
    // Seules les colonnes touchées reviennent en arrière ; les valeurs masquées ne se restaurent pas
    const patch: Record<string, unknown> = {}
    for (const c of champs) {
      if (avant[c] === '[masqué]') continue
      patch[c] = avant[c] === undefined ? null : avant[c]
    }
    if (!Object.keys(patch).length) return { success: false, error: 'Rien à restaurer : les valeurs concernées sont masquées' }
    const { error: e } = await supabase.from(table).update(patch).eq('id', a.record_id)
    if (e) echec = e.message
  } else if (a.operation === 'insert') {
    const { error: e } = await supabase.from(table).delete().eq('id', a.record_id)
    if (e) echec = e.message
  } else if (a.operation === 'delete') {
    if (!avant) return { success: false, error: "État d'avant inconnu" }
    const ligne: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(avant)) if (v !== '[masqué]') ligne[k] = v
    const { error: e } = await supabase.from(table).insert(ligne)
    if (e) echec = e.message
  }
  if (echec) {
    return { success: false, error: `Annulation refusée par la base : ${echec}` }
  }

  await supabase.from('activites')
    .update({ annulee_le: new Date().toISOString(), annulee_par: session.user.id })
    .eq('id', activiteId)
  await logAudit({ action: 'annulation_activite', entity_type: table, entity_id: a.record_id, details: { activite: activiteId, operation: a.operation, champs } })
  revalidatePath('/dashboard/activite')
  return { success: true, data: { avertissement } }
}

/** Les rôles autorisés à consulter le journal, pour la navigation. */
export async function peutVoirJournalAction(): Promise<boolean> {
  const session = await getSession()
  return ROLES_JOURNAL.includes(session.user.role)
}
