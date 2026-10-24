'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { lireJetonDesinscription } from '@/lib/campagnes/desinscription'
import { desinscrireParLien } from '@/lib/campagnes/oppositions'

/**
 * « Ne plus rien recevoir » depuis la page de désinscription. Point d'entrée
 * public : seul le jeton signé du lien dit qui se désinscrit ; l'appel répété
 * ne change rien.
 */
export async function desinscrireAction(jeton: string): Promise<{ success: boolean; error?: string }> {
  const cible = lireJetonDesinscription(jeton)
  if (!cible) return { success: false, error: 'Ce lien de désinscription n’est pas valide.' }
  try {
    const supabase = await createServiceRoleClient()
    await desinscrireParLien(supabase, cible, 'Page de désinscription du site')
    return { success: true }
  } catch (e: any) {
    console.error('[désinscription] page', e?.message || e)
    return { success: false, error: 'La désinscription est indisponible pour le moment. Écrivez-nous à contact@lab-learning.fr.' }
  }
}
