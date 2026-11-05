/**
 * Émargement d'un participant, demi-journée par demi-journée (demande de
 * Brahim du 05/11/2026, POEI) : l'administration marque présent, absent ou
 * repos, puis envoie au stagiaire le lien de son espace pour qu'il signe ses
 * journées de présence. Les formateurs se contentaient souvent de cocher
 * « présent » sans faire signer.
 * Module sans import serveur : partagé client et serveur.
 */
import { estRepos } from '@/lib/emargement-repos'

export type StatutCreneau = 'signe' | 'present' | 'absent' | 'repos' | 'a_signer' | 'a_venir'

export interface CreneauParticipant {
  id: string
  session_id: string
  date: string
  creneau: string
  statut: StatutCreneau
  motif: string | null
  signed_at: string | null
  /** Feuille de la demi-journée validée par le formateur : le stagiaire ne peut plus signer */
  verrouille: boolean
  /** Jour à venir : absence ou repos peuvent être posés d'avance, pas la présence */
  futur: boolean
}

export const LIBELLE_STATUT: Record<StatutCreneau, string> = {
  signe: 'Signé',
  present: 'Présent, à signer',
  absent: 'Absent',
  repos: 'Repos',
  a_signer: 'Non renseigné',
  a_venir: 'À venir',
}

export const LIBELLE_CRENEAU: Record<string, string> = { matin: 'Matin', apres_midi: 'Après-midi', journee: 'Journée' }
export const ORDRE_CRENEAU: Record<string, number> = { matin: 0, journee: 1, apres_midi: 2 }

/** L'état d'une ligne d'émargement, vu par l'administration */
export function statutCreneau(
  e: { date: string; est_present: boolean | null; signature_data?: string | null; signed_at?: string | null; motif_absence: string | null },
  aujourdhui: string,
): StatutCreneau {
  if (e.signature_data) return 'signe'
  if (estRepos(e)) return 'repos'
  if (e.motif_absence) return 'absent'
  if (e.est_present) return 'present'
  return e.date > aujourdhui ? 'a_venir' : 'a_signer'
}

/** Ce que le stagiaire peut signer dans son espace : passé, non signé, sans absence ni repos, feuille ouverte */
export const signableParLeStagiaire = (c: Pick<CreneauParticipant, 'statut' | 'verrouille'>) =>
  (c.statut === 'present' || c.statut === 'a_signer') && !c.verrouille

/** À signer mais bloqué par une feuille validée : il faut la rouvrir */
export const bloqueParFeuille = (c: Pick<CreneauParticipant, 'statut' | 'verrouille'>) =>
  (c.statut === 'present' || c.statut === 'a_signer') && c.verrouille
