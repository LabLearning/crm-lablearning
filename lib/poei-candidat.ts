/**
 * Période et volume horaire d'un candidat POEI.
 *
 * Le projet porte un calendrier commun, mais un candidat recruté après le
 * lancement entre en cours de route : ses dates et ses heures lui sont
 * propres, et c'est ce qui doit figurer sur sa convention, son attestation
 * d'entrée et sa facture France Travail.
 *
 * Règle, de la plus forte à la plus faible :
 *   1. abandon déclaré → heures réellement effectuées (prorata France Travail)
 *   2. valeur saisie sur le candidat
 *   3. valeur du projet
 */

export const MESSAGE_MIGRATION_PERIODE =
  'Appliquez la migration 151 pour donner des dates propres à un candidat.'

export interface CandidatPeriode {
  date_debut?: string | null
  date_fin?: string | null
  duree_heures?: number | string | null
  statut?: string | null
  date_abandon?: string | null
  heures_effectuees?: number | string | null
}

export interface ProjetPeriode {
  date_debut?: string | null
  date_fin?: string | null
  duree_heures?: number | string | null
}

export interface InterventionPeriode {
  date_debut?: string | null
  date_fin?: string | null
  nb_heures?: number | string | null
}

const nombre = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export interface PeriodeCandidat {
  debut: string | null
  fin: string | null
  heures: number | null
  /** Le candidat ne suit pas le calendrier du projet. */
  personnalisee: boolean
  /** Entrée après le démarrage du projet. */
  entreeDecalee: boolean
  /** Sortie avant la fin du projet (abandon compris). */
  sortieAnticipee: boolean
  abandon: boolean
}

/** La période réellement suivie par un candidat, et sa durée. */
export function periodeCandidat(candidat: CandidatPeriode, projet: ProjetPeriode): PeriodeCandidat {
  const abandon = candidat.statut === 'abandonne' && !!candidat.date_abandon
  const debut = candidat.date_debut || projet.date_debut || null
  const finProjet = projet.date_fin || null
  const fin = abandon ? candidat.date_abandon! : (candidat.date_fin || finProjet)

  const heuresAbandon = abandon ? nombre(candidat.heures_effectuees) : null
  const heures = heuresAbandon ?? nombre(candidat.duree_heures) ?? nombre(projet.duree_heures)

  return {
    debut, fin, heures,
    personnalisee: !!(candidat.date_debut || candidat.date_fin || nombre(candidat.duree_heures) != null),
    entreeDecalee: !!(candidat.date_debut && projet.date_debut && candidat.date_debut > projet.date_debut),
    sortieAnticipee: !!(fin && finProjet && fin < finProjet),
    abandon,
  }
}

/** Heures à facturer à France Travail pour ce candidat. */
export function heuresFacturables(candidat: CandidatPeriode, projet: ProjetPeriode): number {
  return periodeCandidat(candidat, projet).heures ?? 0
}

/**
 * Heures déduites du planning pour une période donnée : somme des
 * interventions qui commencent dans la fenêtre. Sert à proposer une durée
 * quand on saisit une entrée décalée, jamais à l'imposer.
 */
export function heuresDepuisInterventions(
  interventions: InterventionPeriode[],
  debut: string | null,
  fin: string | null,
): number | null {
  if (!debut && !fin) return null
  const retenues = interventions.filter((i) => {
    const d = i.date_debut || null
    if (!d) return false
    if (debut && d < debut) return false
    if (fin && d > fin) return false
    return true
  })
  if (!retenues.length) return null
  const total = retenues.reduce((t, i) => t + (nombre(i.nb_heures) || 0), 0)
  return total > 0 ? Math.round(total * 100) / 100 : null
}

/** Montant France Travail d'un candidat : ses heures au taux du projet. */
export function montantCandidat(
  candidat: CandidatPeriode,
  projet: ProjetPeriode & { montant_horaire?: number | string | null },
): number | null {
  const taux = nombre(projet.montant_horaire)
  const heures = periodeCandidat(candidat, projet).heures
  if (taux == null || heures == null) return null
  return Math.round(heures * taux * 100) / 100
}

/** Total du projet : la somme des candidats, et non une durée unique × un effectif. */
export function montantTotalPoei(
  candidats: CandidatPeriode[],
  projet: ProjetPeriode & { montant_horaire?: number | string | null },
): number | null {
  if (!candidats.length) return null
  if (nombre(projet.montant_horaire) == null) return null
  let total = 0
  let connu = false
  for (const c of candidats) {
    const m = montantCandidat(c, projet)
    if (m != null) { total += m; connu = true }
  }
  return connu ? Math.round(total * 100) / 100 : null
}

/** « du 12/05/2026 au 30/06/2026 », ou une borne seule si l'autre manque. */
export function libellePeriode(debut: string | null, fin: string | null): string {
  const fr = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR')
  if (debut && fin) return debut === fin ? `le ${fr(debut)}` : `du ${fr(debut)} au ${fr(fin)}`
  if (debut) return `à partir du ${fr(debut)}`
  if (fin) return `jusqu'au ${fr(fin)}`
  return ''
}
