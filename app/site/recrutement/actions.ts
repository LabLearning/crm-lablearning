'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { InscriptionFormateur } from '@/lib/inscription-formateur'
import { enregistrerInscription, preparerDepotCv, type Resultat } from '@/lib/inscription-formateur-serveur'
import { CLE_GARDE_CANDIDATURE, ORG_SITE, POSTES_CANDIDATURE } from './candidature'

/**
 * L'organisme du site public : Lab Learning. Hors production, CANDIDATURE_ORG_TEST
 * permet de dérouler le formulaire de bout en bout sur un organisme d'essai,
 * sans créer de fiche ni alerter l'équipe chez Lab Learning.
 */
async function organisme(supabase: any) {
  const id = (process.env.NODE_ENV !== 'production' && process.env.CANDIDATURE_ORG_TEST) || ORG_SITE
  const { data } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle()
  return (data as any) || null
}

/** Prépare le dépôt du CV d'un candidat : le navigateur l'envoie ensuite directement au stockage. */
export async function preparerCvCandidatureAction(jetonPage: string, nomFichier: string, taille: number, type: string): Promise<Resultat<{ path: string; jeton: string }>> {
  const supabase = await createServiceRoleClient()
  const org = await organisme(supabase)
  if (!org) return { success: false, error: 'Le dépôt du CV est indisponible. Réessayez dans un instant.' }
  return preparerDepotCv(supabase, org, CLE_GARDE_CANDIDATURE, jetonPage, nomFichier, taille, type)
}

/**
 * Candidature d'un formateur depuis le site. Elle arrive dans le CRM comme une
 * fiche formateur inactive, « à vérifier » : l'équipe la retient ou l'écarte.
 * Mêmes garde-fous que le lien général (anti-robots, limites par heure, CV vérifié).
 */
export async function postulerFormateurAction(
  saisie: InscriptionFormateur,
  garde: { jeton: string; pot: string },
  poste: string | null,
): Promise<Resultat<{ resultat: 'cree' | 'complete' }>> {
  const supabase = await createServiceRoleClient()
  const org = await organisme(supabase)
  if (!org) return { success: false, error: 'L’envoi est indisponible pour le moment. Réessayez dans un instant.' }
  // Seul un poste de la liste publiée est retenu : le libellé part dans les notes et les mails internes
  const posteConnu = POSTES_CANDIDATURE.find((p) => p.cle === poste)?.libelle || null
  return enregistrerInscription(supabase, org, CLE_GARDE_CANDIDATURE, saisie, garde, { mode: 'candidature', poste: posteConnu })
}
