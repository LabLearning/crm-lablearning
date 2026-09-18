'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { libelleChamp, TABLES_ACTIVITE } from '@/lib/activite'
import type { ActionResult } from '@/lib/types'

const ROLES_ANNULATION = ['super_admin']
const MARQUE_MASQUE = '[masqué]'

/** Ligne du journal telle que lue en base. */
interface LigneJournal {
  id: string
  organization_id: string | null
  table_name: string
  record_id: string | null
  operation: 'insert' | 'update' | 'delete'
  champs: string[]
  avant: Record<string, unknown> | null
  apres: Record<string, unknown> | null
  transaction_id: number | string | null
  annulee_le: string | null
  created_at: string
}

/** Retire les colonnes masquées d'une ligne à réinsérer ; renvoie aussi leurs noms. */
function sansMasques(ligne: Record<string, unknown>): { ligne: Record<string, unknown>; masques: string[] } {
  const propre: Record<string, unknown> = {}
  const masques: string[] = []
  for (const [k, v] of Object.entries(ligne)) {
    if (v === MARQUE_MASQUE) masques.push(k)
    else propre[k] = v
  }
  return { ligne: propre, masques }
}

const nomTable = (t: string) => TABLES_ACTIVITE[t]?.pluriel?.toLowerCase() || t.replace(/_/g, ' ')

/**
 * Annule une activité du journal : remet la ligne dans l'état d'avant.
 *
 * - modification : les colonnes touchées reprennent leur valeur d'avant ;
 * - création : la ligne créée est supprimée, à condition que rien ne
 *   dépende d'elle (sinon la base emporterait les lignes liées en cascade) ;
 * - suppression : la ligne est recréée telle qu'elle était, avec les lignes
 *   liées supprimées dans la même transaction (lignes de facture,
 *   inscriptions…), parents avant enfants.
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
  const act = a as LigneJournal
  if (act.annulee_le) return { success: false, error: 'Cette activité a déjà été annulée' }
  if (!act.record_id) return { success: false, error: 'Ligne sans identifiant : annulation impossible' }
  if (!(act.table_name in TABLES_ACTIVITE) && !['facture_lignes', 'devis_lignes', 'session_formations'].includes(act.table_name)) {
    return { success: false, error: 'Cette table ne peut pas être annulée depuis le journal' }
  }

  const avertissements: string[] = []
  const masquesNonRestaures: string[] = []
  let echec: string | null = null

  if (act.operation === 'update') {
    if (!act.avant) return { success: false, error: "État d'avant inconnu" }
    // Des modifications plus récentes sur la même ligne : on prévient, on n'empêche pas
    const { count: plusRecentes } = await supabase.from('activites')
      .select('id', { count: 'exact', head: true })
      .eq('table_name', act.table_name).eq('record_id', act.record_id).gt('created_at', act.created_at).is('annulee_le', null)
    if ((plusRecentes || 0) > 0) {
      avertissements.push(`${plusRecentes} modification${(plusRecentes || 0) > 1 ? 's' : ''} plus récente${(plusRecentes || 0) > 1 ? 's' : ''} sur cette fiche ${(plusRecentes || 0) > 1 ? 'ont été conservées' : 'a été conservée'}.`)
    }
    // Seules les colonnes touchées reviennent en arrière ; les valeurs masquées ne se restaurent pas
    const patch: Record<string, unknown> = {}
    for (const c of act.champs) {
      if (act.avant[c] === MARQUE_MASQUE) { masquesNonRestaures.push(c); continue }
      patch[c] = act.avant[c] === undefined ? null : act.avant[c]
    }
    if (!Object.keys(patch).length) return { success: false, error: 'Rien à restaurer : les valeurs concernées sont masquées (secret ou signature)' }
    const { error: e } = await supabase.from(act.table_name).update(patch).eq('id', act.record_id)
    if (e) echec = e.message
  } else if (act.operation === 'insert') {
    // Une fiche qui a déjà des lignes liées ne se supprime pas d'un clic : la base les emporterait
    const { data: deps, error: eDeps } = await supabase.rpc('journal_dependances', { p_table: act.table_name, p_id: act.record_id })
    if (eDeps) return { success: false, error: 'Vérification des dépendances impossible : appliquer la migration 155' }
    const liees = Object.entries((deps || {}) as Record<string, number>).filter(([, n]) => Number(n) > 0)
    if (liees.length) {
      return {
        success: false,
        error: `Impossible d'annuler cette création : ${liees.map(([t, n]) => `${n} ${nomTable(t)}`).join(', ')} en dépendent. Supprimez-les d'abord, ou modifiez la fiche.`,
      }
    }
    const { count: modifsDepuis } = await supabase.from('activites')
      .select('id', { count: 'exact', head: true })
      .eq('table_name', act.table_name).eq('record_id', act.record_id).eq('operation', 'update').gt('created_at', act.created_at).is('annulee_le', null)
    if ((modifsDepuis || 0) > 0) avertissements.push(`La fiche avait été modifiée ${modifsDepuis} fois depuis sa création.`)
    const { error: e } = await supabase.from(act.table_name).delete().eq('id', act.record_id)
    if (e) echec = e.message
  } else if (act.operation === 'delete') {
    if (!act.avant) return { success: false, error: "État d'avant inconnu" }
    // Le lot : la fiche et tout ce qui est parti avec elle dans la même transaction
    let lot: LigneJournal[] = [act]
    if (act.transaction_id != null) {
      const { data: memeTx } = await supabase.from('activites').select('*')
        .eq('organization_id', orgId).eq('transaction_id', act.transaction_id).eq('operation', 'delete').is('annulee_le', null)
      if (memeTx?.length) lot = memeTx as LigneJournal[]
    }
    // Parents d'abord : la fiche demandée en tête, puis les autres ; en cas de clé
    // étrangère manquante on repasse, jusqu'à ce que plus rien n'avance
    const restantes = [act, ...lot.filter((x) => x.id !== act.id)]
    const restaurees: LigneJournal[] = []
    let derniereErreur: string | null = null
    for (let passe = 0; passe < 6 && restantes.length; passe++) {
      let progres = false
      for (const x of [...restantes]) {
        if (!x.avant) { restantes.splice(restantes.indexOf(x), 1); continue }
        const { ligne, masques } = sansMasques(x.avant)
        const { error: e } = await supabase.from(x.table_name).insert(ligne)
        if (!e) {
          masquesNonRestaures.push(...masques.map((m) => `${nomTable(x.table_name)} : ${libelleChamp(m)}`))
          restaurees.push(x); restantes.splice(restantes.indexOf(x), 1); progres = true
        } else if (/duplicate key|already exists/i.test(e.message)) {
          // Déjà là (recréée par ailleurs) : on la considère restaurée
          restaurees.push(x); restantes.splice(restantes.indexOf(x), 1); progres = true
        } else {
          derniereErreur = e.message
        }
      }
      if (!progres) break
    }
    if (!restaurees.some((x) => x.id === act.id)) {
      echec = derniereErreur || 'La fiche n’a pas pu être recréée'
    } else {
      // Les lignes liées recréées sont marquées annulées avec la fiche
      const autres = restaurees.filter((x) => x.id !== act.id)
      if (autres.length) {
        await supabase.from('activites')
          .update({ annulee_le: new Date().toISOString(), annulee_par: session.user.id })
          .in('id', autres.map((x) => x.id))
        avertissements.push(`${autres.length} ligne${autres.length > 1 ? 's' : ''} liée${autres.length > 1 ? 's' : ''} recréée${autres.length > 1 ? 's' : ''} avec la fiche.`)
      }
      if (restantes.length) {
        avertissements.push(`${restantes.length} ligne${restantes.length > 1 ? 's' : ''} liée${restantes.length > 1 ? 's' : ''} n’${restantes.length > 1 ? 'ont' : 'a'} pas pu être recréée${restantes.length > 1 ? 's' : ''}${derniereErreur ? ` (${derniereErreur})` : ''}.`)
      }
    }
  }

  if (echec) return { success: false, error: `Annulation refusée par la base : ${echec}` }

  if (masquesNonRestaures.length) {
    avertissements.push(`Non restauré (secret ou signature) : ${[...new Set(masquesNonRestaures)].map((m) => m.includes(':') ? m : libelleChamp(m)).join(', ')}.`)
  }

  await supabase.from('activites')
    .update({ annulee_le: new Date().toISOString(), annulee_par: session.user.id })
    .eq('id', activiteId)
  await logAudit({ action: 'annulation_activite', entity_type: act.table_name, entity_id: act.record_id, details: { activite: activiteId, operation: act.operation, champs: act.champs } })
  revalidatePath('/dashboard/activite')
  return { success: true, data: { avertissement: avertissements.length ? avertissements.join(' ') : undefined } }
}
