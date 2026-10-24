'use server'

import { getSession } from '@/lib/auth'
import { checkDashboardAccess } from '@/lib/dashboard-guard'
import { extractParticipantsFromText } from '@/lib/ai'
import type { ActionResult } from '@/lib/types'

/**
 * Import en masse des participants, étape 1 : l'IA lit le texte collé et rend
 * des lignes à relire ; rien n'est enregistré. Action exportée, donc joignable
 * hors du tableau de bord : réservée à qui ouvre la page Apprenants (chaque
 * appel coûte un appel au modèle).
 */
export async function extractParticipantsFromTextAction(rawText: string): Promise<ActionResult> {
  const session = await getSession()
  if (!checkDashboardAccess('/dashboard/apprenants', session.user.role as any, session.permissions).allowed) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const result = await extractParticipantsFromText(String(rawText ?? '').slice(0, 50000))
  if (!result.success) return { success: false, error: result.error || 'Extraction impossible' }
  // `error` peut accompagner un succès partiel (liste tronquée) : on remonte
  // les participants lus ET l'avertissement
  return { success: true, data: result.participants, error: result.error }
}
