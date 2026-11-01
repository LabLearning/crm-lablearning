/**
 * Questionnaires ouverts par le formateur au fil du cours (novembre 2026, POEI
 * Chamas Tacos : un quiz par demi-journée, à passer quand le cours en est là).
 *
 * Un questionnaire rattaché à une session sans date d'ouverture
 * (qcm_sessions.date_ouverture vide) est fermé : le stagiaire ne le voit pas et
 * ne peut pas le soumettre. Le formateur l'ouvre depuis son espace, ou en
 * l'envoyant aux stagiaires. Les autres rattachements sont ouverts dès leur
 * création (valeur par défaut de la colonne), et une réponse sans rattachement
 * (anciennes données) reste visible.
 */

export function estOuvert(dateOuverture: string | null | undefined, maintenant = new Date()): boolean {
  return !!dateOuverture && new Date(dateOuverture) <= maintenant
}

/** Les réponses dont le questionnaire est ouvert (celles sans rattachement comprises). */
export async function reponsesOuvertes<T extends { qcm_session_id?: string | null }>(supabase: any, reponses: T[]): Promise<T[]> {
  const ids = Array.from(new Set(reponses.map((r) => r.qcm_session_id).filter(Boolean))) as string[]
  if (!ids.length) return reponses
  const fermes = new Set<string>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('qcm_sessions').select('id, date_ouverture').in('id', ids.slice(i, i + 150))
    for (const q of (data || []) as any[]) if (!estOuvert(q.date_ouverture)) fermes.add(q.id)
  }
  return reponses.filter((r) => !r.qcm_session_id || !fermes.has(r.qcm_session_id))
}

/** Le questionnaire de cette réponse est-il ouvert ? (sans rattachement : oui) */
export async function reponseOuverte(supabase: any, qcmSessionId: string | null | undefined): Promise<boolean> {
  if (!qcmSessionId) return true
  const { data } = await supabase.from('qcm_sessions').select('date_ouverture').eq('id', qcmSessionId).maybeSingle()
  return !data || estOuvert(data.date_ouverture)
}
