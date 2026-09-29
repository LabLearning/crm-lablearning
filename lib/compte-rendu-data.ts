/**
 * Ce que le compte rendu d'une session doit couvrir : ses demi-journées, les
 * objectifs de sa formation et ses stagiaires. Côté serveur uniquement.
 */

import { compteRenduVierge, fusionnerCompteRendu, objectifsFormation, ordreDemiJournee, type CompteRendu, type Creneau } from './compte-rendu'
import { fetchAllPaged } from './supabase/fetch-all'

/**
 * Demi-journées de la session : celles de la feuille d'émargement comprises
 * entre ses dates (une session reprogrammée garde d'anciennes lignes), sinon
 * tous les jours du début à la fin (hors dimanche), matin et après-midi.
 */
export async function demiJourneesSession(
  supabase: any,
  session: { id: string; date_debut: string | null; date_fin: string | null },
): Promise<{ date: string; creneau: Creneau }[]> {
  // Une ligne par stagiaire et par demi-journée : lecture par pages
  const em = await fetchAllPaged((from, to) =>
    supabase.from('emargements').select('date, creneau').eq('session_id', session.id).order('date').range(from, to))
  const debut = String(session.date_debut || '').slice(0, 10)
  const finSession = String(session.date_fin || session.date_debut || '').slice(0, 10)
  const vues = new Set<string>()
  const liste: { date: string; creneau: Creneau }[] = []
  for (const e of em as any[]) {
    const date = String(e.date || '').slice(0, 10)
    const creneau = e.creneau === 'apres_midi' ? 'apres_midi' : 'matin'
    if (!date || vues.has(`${date}|${creneau}`)) continue
    if ((debut && date < debut) || (finSession && date > finSession)) continue
    vues.add(`${date}|${creneau}`)
    liste.push({ date, creneau })
  }
  if (!liste.length && session.date_debut) {
    const fin = new Date(`${String(session.date_fin || session.date_debut).slice(0, 10)}T12:00:00Z`)
    for (let d = new Date(`${String(session.date_debut).slice(0, 10)}T12:00:00Z`); d <= fin && liste.length < 60; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0) continue
      const date = d.toISOString().slice(0, 10)
      liste.push({ date, creneau: 'matin' }, { date, creneau: 'apres_midi' })
    }
  }
  return liste.sort(ordreDemiJournee)
}

/** Compte rendu de la session : l'enregistré, complété de ce que la session compte aujourd'hui. */
export async function compteRenduSession(
  supabase: any,
  session: { id: string; date_debut: string | null; date_fin: string | null; formation_id?: string | null },
  enregistre: unknown,
): Promise<CompteRendu> {
  const { participantsFeuille } = await import('./emargement-participants')
  const [creneaux, participants, { data: formation }] = await Promise.all([
    demiJourneesSession(supabase, session),
    participantsFeuille(supabase, session.id),
    session.formation_id
      ? supabase.from('formations').select('objectifs_pedagogiques').eq('id', session.formation_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])
  const vierge = compteRenduVierge({
    creneaux,
    objectifs: objectifsFormation(formation?.objectifs_pedagogiques),
    // Un stagiaire désinscrit après avoir émargé reste, comme sur la feuille
    stagiaires: participants
      .map((p: any) => ({ id: p.id, nom: `${p.prenom || ''} ${(p.nom || '').toUpperCase()}`.trim(), retire: !!p.retire })),
  })
  return fusionnerCompteRendu(enregistre as any, vierge)
}
