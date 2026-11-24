/**
 * Module hygiène alimentaire d'un parcours POEI : les deux premiers jours de
 * formation (14 heures, arrêté du 12 février 2024).
 *
 * Un candidat qui abandonne le parcours après ce module l'a suivi en entier :
 * son attestation d'hygiène lui est due, aux dates du module. Il y a droit
 * quand il a quitté le parcours le dernier jour du module ou après, et
 * qu'aucune absence n'est déclarée sur ces deux jours (un jour de repos n'est
 * pas une absence). Sans date d'abandon connue, chaque demi-journée du module
 * doit être émargée.
 */

/** Jours de formation que couvre le module hygiène d'une POEI */
export const JOURS_MODULE_HYGIENE_POEI = 2

const estRepos = (motif: unknown) => String(motif || '').trim().toLowerCase() === 'repos'

/** Jours ouvrés (lundi à vendredi) à partir d'une date AAAA-MM-JJ */
function joursOuvres(depuis: string, nombre: number): string[] {
  const jours: string[] = []
  const d = new Date(`${depuis}T12:00:00Z`)
  for (let i = 0; jours.length < nombre && i < 31; i++) {
    const j = d.getUTCDay()
    if (j !== 0 && j !== 6) jours.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return jours
}

/** Sessions supports d'une POEI : celles de ses interventions, et sa session chapeau */
async function sessionsDuParcours(supabase: any, orgId: string, poei: { id: string; session_id?: string | null }): Promise<string[]> {
  const { data: itv } = await supabase.from('poei_interventions').select('id').eq('poei_id', poei.id).eq('organization_id', orgId)
  const ids = ((itv || []) as any[]).map((i) => i.id)
  const { data: sess } = ids.length
    ? await supabase.from('sessions').select('id').in('poei_intervention_id', ids).eq('organization_id', orgId)
    : { data: [] }
  return Array.from(new Set([...((sess || []) as any[]).map((s) => s.id), poei.session_id].filter(Boolean))) as string[]
}

export interface ModuleHygienePoei {
  /** Les jours du module (AAAA-MM-JJ), dans l'ordre */
  jours: string[]
  /** Candidats ayant abandonné qui ont suivi tout le module (identifiants poei_candidats) */
  abandonsAttestables: Set<string>
}

/**
 * Jours du module hygiène d'une POEI (les deux premiers jours émargés, à
 * défaut les deux premiers jours ouvrés du parcours) et, parmi les candidats
 * qui ont abandonné, ceux qui l'ont suivi en entier.
 */
export async function moduleHygienePoei(
  supabase: any,
  orgId: string,
  poei: { id: string; date_debut?: string | null; session_id?: string | null },
  candidats: { id: string; apprenant_id: string | null; statut?: string | null; date_abandon?: string | null }[],
): Promise<ModuleHygienePoei> {
  const sessionIds = await sessionsDuParcours(supabase, orgId, poei)
  const lignes: any[] = []
  if (sessionIds.length) {
    // Les premières lignes suffisent : un jour compte une ligne par stagiaire et demi-journée
    const { data } = await supabase.from('emargements')
      .select('apprenant_id, date, creneau, est_present, signature_data, motif_absence')
      .in('session_id', sessionIds).order('date', { ascending: true }).limit(1000)
    lignes.push(...((data || []) as any[]))
  }
  // Un jour de formation : au moins une ligne qui n'est pas un repos
  let jours = Array.from(new Set(lignes.filter((l) => !estRepos(l.motif_absence)).map((l) => String(l.date).slice(0, 10))))
    .sort().slice(0, JOURS_MODULE_HYGIENE_POEI)
  if (jours.length < JOURS_MODULE_HYGIENE_POEI && poei.date_debut) jours = joursOuvres(String(poei.date_debut).slice(0, 10), JOURS_MODULE_HYGIENE_POEI)

  const abandonsAttestables = new Set<string>()
  const dernier = jours[jours.length - 1]
  const aujourdhui = new Date().toISOString().slice(0, 10)
  if (jours.length === JOURS_MODULE_HYGIENE_POEI && dernier < aujourdhui) {
    for (const c of candidats) {
      if (c.statut !== 'abandonne' || !c.apprenant_id) continue
      const siennes = lignes.filter((l) => l.apprenant_id === c.apprenant_id && jours.includes(String(l.date).slice(0, 10)))
      if (siennes.some((l) => l.motif_absence && !estRepos(l.motif_absence))) continue
      const abandon = c.date_abandon ? String(c.date_abandon).slice(0, 10) : null
      const suivi = abandon
        ? abandon >= dernier
        // Date d'abandon inconnue : chaque demi-journée du module émargée
        : siennes.length >= JOURS_MODULE_HYGIENE_POEI * 2 && siennes.every((l) => l.signature_data || l.est_present)
      if (suivi) abandonsAttestables.add(c.id)
    }
  }
  return { jours, abandonsAttestables }
}
