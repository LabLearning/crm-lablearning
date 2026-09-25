/**
 * Heures réalisées et assiduité portées sur les certificats de réalisation et
 * les attestations.
 *
 * Deux règles, tirées de la façon dont les feuilles vivent réellement :
 *
 *  1. Une demi-journée non signée n'est pas une absence. La ligne d'émargement
 *     naît avec « présent = non » et le reste tant que personne ne signe :
 *     compter ces lignes comme des absences amputait les heures certifiées
 *     (VBI : 75 h portées au lieu des 105 h du parcours). Seule compte
 *     l'absence déclarée par le formateur, qui porte toujours un motif.
 *
 *  2. Une POEI porte la durée de son parcours, pas un prorata de signatures.
 *     La durée retenue est celle du candidat si elle lui est propre (entrée
 *     décalée), ses heures effectuées si le parcours a été interrompu, sinon
 *     la durée du parcours.
 */

export interface HeuresCertificat {
  /** Heures à porter sur le document. */
  heures: number
  /** Taux d'assiduité, seulement quand il a un sens (hors POEI). */
  assiduite?: number
  /** Durée de référence de l'action (POEI : le parcours ; sinon : la formation). */
  dureeTotale: number
  source: 'poei' | 'emargements' | 'duree_prevue'
}

const nombre = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Heures certifiées pour chaque stagiaire d'une session, par apprenant_id.
 * `dureeFormation` sert de repli quand ni la POEI ni la formation ne donnent
 * de durée.
 */
export async function heuresCertificats(
  supabase: any,
  params: { sessionId: string; organizationId: string; dureeFormation?: number | null },
): Promise<Map<string, HeuresCertificat>> {
  const { sessionId, organizationId } = params
  const dureeFormation = nombre(params.dureeFormation) || 0
  const out = new Map<string, HeuresCertificat>()

  // ── La session appartient-elle à un parcours POEI ? ──
  const poei = await poeiDeLaSession(supabase, sessionId, organizationId)
  if (poei) return heuresCertificatsPoei(supabase, poei, dureeFormation)

  // ── Session ordinaire : la durée prévue, moins les absences déclarées ──
  const { data: lignes } = await supabase
    .from('emargements')
    .select('apprenant_id, motif_absence')
    .eq('session_id', sessionId)

  const parApprenant = new Map<string, { total: number; absences: number }>()
  for (const l of (lignes || []) as any[]) {
    const k = String(l.apprenant_id)
    const e = parApprenant.get(k) || { total: 0, absences: 0 }
    e.total++
    if (l.motif_absence) e.absences++
    parApprenant.set(k, e)
  }

  for (const [apprenantId, { total, absences }] of parApprenant) {
    if (total === 0) {
      out.set(apprenantId, { heures: dureeFormation, dureeTotale: dureeFormation, source: 'duree_prevue' })
      continue
    }
    const taux = (total - absences) / total
    out.set(apprenantId, {
      heures: Math.round(dureeFormation * taux),
      assiduite: Math.round(taux * 100),
      dureeTotale: dureeFormation,
      source: 'emargements',
    })
  }
  return out
}

/**
 * Heures certifiées des candidats d'un parcours POEI, par apprenant_id : la
 * durée propre du candidat, sinon celle du parcours ; ses heures effectuées
 * si le parcours a été interrompu. Ne dépend d'aucune session (un parcours
 * peut ne pas avoir de session chapeau).
 */
export async function heuresCertificatsPoei(
  supabase: any,
  poei: { id: string; duree_heures?: number | null },
  dureeFormation?: number | null,
): Promise<Map<string, HeuresCertificat>> {
  const out = new Map<string, HeuresCertificat>()
  const dureeParcours = nombre(poei.duree_heures) || nombre(dureeFormation) || 0
  const { data: candidats } = await supabase
    .from('poei_candidats')
    .select('apprenant_id, duree_heures, heures_effectuees, statut')
    .eq('poei_id', poei.id)
  for (const c of (candidats || []) as any[]) {
    if (!c.apprenant_id) continue
    const prevu = nombre(c.duree_heures) || dureeParcours
    // Parcours interrompu : les heures effectuées font foi
    const heures = nombre(c.heures_effectuees) ?? prevu
    out.set(String(c.apprenant_id), { heures, dureeTotale: prevu, source: 'poei' })
  }
  return out
}

/** Heures certifiées d'un seul stagiaire. */
export async function heuresCertificat(
  supabase: any,
  params: { sessionId: string; apprenantId: string; organizationId: string; dureeFormation?: number | null },
): Promise<HeuresCertificat> {
  const parApprenant = await heuresCertificats(supabase, params)
  const duree = nombre(params.dureeFormation) || 0
  return parApprenant.get(String(params.apprenantId))
    || { heures: duree, dureeTotale: duree, source: 'duree_prevue' }
}

/**
 * Parcours POEI auquel se rattache une session : la session chapeau du
 * parcours, ou la session d'une de ses interventions.
 */
export async function poeiDeLaSession(
  supabase: any,
  sessionId: string,
  organizationId: string,
): Promise<{ id: string; duree_heures: number | null; date_debut: string | null; date_fin: string | null } | null> {
  const champs = 'id, duree_heures, date_debut, date_fin'
  const { data: parcours } = await supabase
    .from('poei').select(champs)
    .eq('session_id', sessionId).eq('organization_id', organizationId).maybeSingle()
  if (parcours) return parcours as any

  const { data: sess } = await supabase
    .from('sessions').select('poei_intervention_id').eq('id', sessionId).maybeSingle()
  if (!sess?.poei_intervention_id) return null
  const { data: iv } = await supabase
    .from('poei_interventions').select('poei_id').eq('id', sess.poei_intervention_id).maybeSingle()
  if (!iv?.poei_id) return null
  const { data: p } = await supabase
    .from('poei').select(champs).eq('id', iv.poei_id).eq('organization_id', organizationId).maybeSingle()
  return (p as any) || null
}
