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
    .select('id, date_debut, date_fin, poei_intervention_id, horaires_jours')
    .eq('id', sessionId)
    .single()
  if (!sess?.date_debut || !sess?.date_fin) return 0
  // Une session POEI se déroule en entreprise, au rythme de l'établissement :
  // en restauration, le samedi et le dimanche sont des jours travaillés comme
  // les autres. L'exclusion du week-end ne vaut que pour les formations en
  // salle.
  const inclureWeekend = !!sess.poei_intervention_id

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('apprenant_id')
    .eq('session_id', sessionId)
    .not('status', 'in', '("annule","abandonne")')

  const apprenantIds = (inscriptions || [])
    .map((i: any) => i.apprenant_id)
    .filter(Boolean) as string[]
  if (apprenantIds.length === 0) return 0

  // Les jours réellement planifiés font foi quand ils sont saisis
  // (horaires_jours : une formation « 3 jours par semaine » n'a pas de
  // créneau les autres jours, une demi-journée n'a qu'un créneau). Sinon,
  // repli : chaque jour entre les deux dates, samedi et dimanche exclus,
  // sauf POEI en entreprise.
  type Creneau = { date: string; creneau: 'matin' | 'apres_midi'; heure_debut: string | null; heure_fin: string | null }
  const creneaux: Creneau[] = []
  const planning = Array.isArray(sess.horaires_jours) ? sess.horaires_jours.filter((j: any) => j?.date) : []
  if (planning.length) {
    for (const j of planning) {
      const date = String(j.date).slice(0, 10)
      const matin = !!(j.matin_debut && j.matin_fin)
      const aprem = !!(j.aprem_debut && j.aprem_fin)
      if (matin) creneaux.push({ date, creneau: 'matin', heure_debut: j.matin_debut, heure_fin: j.matin_fin })
      if (aprem) creneaux.push({ date, creneau: 'apres_midi', heure_debut: j.aprem_debut, heure_fin: j.aprem_fin })
      // Jour saisi sans horaires : journée complète par défaut
      if (!matin && !aprem) {
        creneaux.push({ date, creneau: 'matin', heure_debut: null, heure_fin: null })
        creneaux.push({ date, creneau: 'apres_midi', heure_debut: null, heure_fin: null })
      }
    }
  } else {
    const d = new Date(sess.date_debut)
    const fin = new Date(sess.date_fin)
    while (d <= fin) {
      const jourSemaine = d.getDay()
      if (inclureWeekend || (jourSemaine !== 0 && jourSemaine !== 6)) {
        const date = d.toISOString().split('T')[0]
        creneaux.push({ date, creneau: 'matin', heure_debut: null, heure_fin: null })
        creneaux.push({ date, creneau: 'apres_midi', heure_debut: null, heure_fin: null })
      }
      d.setDate(d.getDate() + 1)
    }
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
  for (const c of creneaux) {
    for (const apprenant_id of apprenantIds) {
      if (deja.has(`${c.date}|${c.creneau}|${apprenant_id}`)) continue
      aCreer.push({
        organization_id: organizationId,
        session_id: sessionId,
        apprenant_id,
        date: c.date,
        creneau: c.creneau,
        heure_debut: c.heure_debut,
        heure_fin: c.heure_fin,
        est_present: false,
      })
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
