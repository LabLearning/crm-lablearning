/**
 * Génération des feuilles d'émargement d'une session.
 *
 * Elles étaient créées uniquement à l'ouverture de la fiche session par un
 * administrateur : un formateur dont personne n'avait consulté la session
 * n'avait donc aucune feuille à signer. La génération est désormais
 * déclenchée aussi côté formateur et à la création d'une session
 * d'intervention POEI.
 *
 * Idempotente : ne crée que les lignes manquantes.
 */
export async function ensureEmargements(
  supabase: any,
  sessionId: string,
  organizationId: string,
): Promise<number> {
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, date_debut, date_fin')
    .eq('id', sessionId)
    .single()
  if (!sess?.date_debut || !sess?.date_fin) return 0

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  const apprenantIds = (inscriptions || [])
    .map((i: any) => i.apprenant_id)
    .filter(Boolean) as string[]
  if (apprenantIds.length === 0) return 0

  // Samedi et dimanche sont exclus : générer des feuilles le week-end
  // produisait des journées fantômes que le formateur ne peut ni signer ni
  // valider. Une séance exceptionnelle un samedi s'ajoute à la main.
  const jours: string[] = []
  const d = new Date(sess.date_debut)
  const fin = new Date(sess.date_fin)
  while (d <= fin) {
    const jourSemaine = d.getDay()
    if (jourSemaine !== 0 && jourSemaine !== 6) {
      jours.push(d.toISOString().split('T')[0])
    }
    d.setDate(d.getDate() + 1)
  }

  // Une seule lecture de l'existant plutôt qu'une par jour et par créneau
  const { data: existants } = await supabase
    .from('emargements')
    .select('apprenant_id, date, creneau')
    .eq('session_id', sessionId)
  const deja = new Set(
    (existants || []).map((e: any) => `${e.date}|${e.creneau}|${e.apprenant_id}`),
  )

  const aCreer: any[] = []
  for (const jour of jours) {
    for (const creneau of ['matin', 'apres_midi']) {
      for (const apprenant_id of apprenantIds) {
        if (deja.has(`${jour}|${creneau}|${apprenant_id}`)) continue
        aCreer.push({
          organization_id: organizationId,
          session_id: sessionId,
          apprenant_id,
          date: jour,
          creneau,
          est_present: false,
        })
      }
    }
  }

  if (aCreer.length === 0) return 0

  // Insertion par lots : une session longue avec beaucoup de stagiaires
  // dépasse vite les limites d'une requête unique
  for (let i = 0; i < aCreer.length; i += 500) {
    const { error } = await supabase.from('emargements').insert(aCreer.slice(i, i + 500))
    if (error) {
      console.error('[ensureEmargements]', error)
      break
    }
  }
  return aCreer.length
}
