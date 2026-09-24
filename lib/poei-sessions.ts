/**
 * Une POEI = une ligne dans les écrans de sessions.
 *
 * Un parcours porte une session chapeau (poei.session_id) et une session par
 * intervention de formateur (sessions.poei_intervention_id). Les montrer
 * toutes fait apparaître le même parcours plusieurs fois. La règle :
 *  - la session chapeau représente le parcours ;
 *  - un parcours sans session chapeau est représenté par sa première
 *    session d'intervention (sinon il disparaîtrait des écrans) ;
 *  - toutes les autres sessions d'intervention sont des doublons à masquer.
 */
export interface CartePoeiSessions {
  /** Sessions d'intervention qui font doublon avec leur parcours. */
  doublons: Set<string>
  /** Session qui représente un parcours → identifiant du dossier POEI. */
  poeiParSession: Map<string, string>
}

export async function cartePoeiSessions(supabase: any, organizationId: string): Promise<CartePoeiSessions> {
  const doublons = new Set<string>()
  const poeiParSession = new Map<string, string>()

  const { data: poeis } = await supabase.from('poei').select('id, session_id').eq('organization_id', organizationId)
  const liste = (poeis || []) as { id: string; session_id: string | null }[]
  if (!liste.length) return { doublons, poeiParSession }
  const avecChapeau = new Set<string>()
  for (const p of liste) {
    if (p.session_id) { avecChapeau.add(p.id); poeiParSession.set(p.session_id, p.id) }
  }

  const { data: interv } = await supabase.from('poei_interventions').select('id, poei_id').in('poei_id', liste.map((p) => p.id))
  const poeiDeLIntervention = new Map(((interv || []) as any[]).map((i) => [i.id, i.poei_id]))
  if (!poeiDeLIntervention.size) return { doublons, poeiParSession }

  const { data: sessInterv } = await supabase.from('sessions')
    .select('id, poei_intervention_id, date_debut')
    .in('poei_intervention_id', [...poeiDeLIntervention.keys()])
    .order('date_debut', { ascending: true })
  const representant = new Map<string, string>() // poei sans chapeau → sa première session d'intervention
  for (const s of (sessInterv || []) as any[]) {
    const pid = poeiDeLIntervention.get(s.poei_intervention_id)
    if (!pid) continue
    if (avecChapeau.has(pid) || representant.has(pid)) { doublons.add(s.id); continue }
    representant.set(pid, s.id)
    poeiParSession.set(s.id, pid)
  }
  return { doublons, poeiParSession }
}
