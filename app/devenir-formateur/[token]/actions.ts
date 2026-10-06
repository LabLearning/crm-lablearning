'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { InscriptionFormateur } from '@/lib/inscription-formateur'
import { enregistrerInscription, preparerDepotCv, type Resultat } from '@/lib/inscription-formateur-serveur'

/** Organisation du lien général ; null si le jeton est inconnu ou la migration 160 absente. */
async function organisationDuLien(supabase: any, token: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(String(token || ''))) return null
  const { data, error } = await supabase.from('organizations')
    .select('*')
    .eq('inscription_formateur_token', token).maybeSingle()
  if (error || !data) return null
  return data as any
}

/** Prépare le dépôt du CV depuis le lien général : voir preparerDepotCv. */
export async function preparerDepotCvAction(token: string, jetonPage: string, nomFichier: string, taille: number, type: string): Promise<Resultat<{ path: string; jeton: string }>> {
  const supabase = await createServiceRoleClient()
  const org = await organisationDuLien(supabase, token)
  if (!org) return { success: false, error: 'Lien d’inscription invalide ou expiré.' }
  return preparerDepotCv(supabase, org, token, jetonPage, nomFichier, taille, type)
}

/** Enregistre la fiche remplie par un formateur depuis le lien général : voir enregistrerInscription. */
export async function soumettreInscriptionFormateurAction(
  token: string,
  saisie: InscriptionFormateur,
  garde: { jeton: string; pot: string },
): Promise<Resultat<{ resultat: 'cree' | 'complete' }>> {
  const supabase = await createServiceRoleClient()
  const org = await organisationDuLien(supabase, token)
  if (!org) return { success: false, error: 'Lien d’inscription invalide ou expiré.' }
  return enregistrerInscription(supabase, org, token, saisie, garde, { mode: 'fiche' })
}
