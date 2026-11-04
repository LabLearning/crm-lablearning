/**
 * Jour de repos d'un stagiaire (POEI en immersion, planning du restaurant…).
 * Demande de Brahim du 04/11/2026 : le formateur le marque « Repos », à côté
 * d'« Absent ». Il est enregistré comme un motif réservé (est_present = false,
 * motif_absence = 'Repos') : sans migration, et ni présence ni absence. Un
 * repos ne compte pas dans les absences, l'assiduité ni les heures.
 */
export const MOTIF_REPOS = 'Repos'

export const estMotifRepos = (motif: string | null | undefined) => (motif || '').trim().toLowerCase() === 'repos'

export const estRepos = (e: { est_present?: boolean | null; motif_absence?: string | null }) =>
  !e.est_present && estMotifRepos(e.motif_absence)
