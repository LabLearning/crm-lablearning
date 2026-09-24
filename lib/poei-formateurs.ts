/**
 * Formateurs d'un parcours POEI, pour l'afficher d'un coup d'œil.
 *
 * La session chapeau d'une POEI n'a pas de formateur : il est porté par les
 * interventions, ou par la session que chaque intervention a engendrée (celle
 * que le formateur anime). On lit les deux. Celui qui intervient à la date du
 * jour est cité en premier ; au-delà de deux noms, « +n ».
 */
export async function formateursDesPoei(
  supabase: any,
  poeiIds: string[],
  aujourdhui = new Date().toISOString().slice(0, 10),
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!poeiIds.length) return out

  const { data: interv } = await supabase.from('poei_interventions')
    .select('id, poei_id, date_debut, date_fin, formateur:formateur_id(prenom, nom)')
    .in('poei_id', poeiIds).order('date_debut', { ascending: true })
  const intervIds = ((interv || []) as any[]).map((i) => i.id)
  const { data: sessInterv } = intervIds.length
    ? await supabase.from('sessions').select('poei_intervention_id, formateur:formateurs(prenom, nom)')
      .in('poei_intervention_id', intervIds).not('formateur_id', 'is', null)
    : { data: [] as any[] }
  const formateurSessionInterv = new Map<string, any>()
  for (const x of (sessInterv || []) as any[]) if (x.formateur) formateurSessionInterv.set(x.poei_intervention_id, x.formateur)

  const parPoei = new Map<string, { nom: string; enCours: boolean }[]>()
  for (const i of (interv || []) as any[]) {
    const f = i.formateur || formateurSessionInterv.get(i.id)
    const nom = `${f?.prenom || ''} ${f?.nom || ''}`.trim()
    if (!nom) continue
    const liste = parPoei.get(i.poei_id) || []
    const enCours = !!i.date_debut && !!i.date_fin && i.date_debut <= aujourdhui && i.date_fin >= aujourdhui
    const existant = liste.find((x) => x.nom === nom)
    if (existant) existant.enCours = existant.enCours || enCours
    else liste.push({ nom, enCours })
    parPoei.set(i.poei_id, liste)
  }
  for (const [pid, liste] of parPoei) {
    const tries = [...liste].sort((a, b) => Number(b.enCours) - Number(a.enCours))
    out.set(pid, tries.slice(0, 2).map((x) => x.nom).join(', ') + (tries.length > 2 ? ` +${tries.length - 2}` : ''))
  }
  return out
}
