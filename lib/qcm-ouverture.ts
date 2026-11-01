/**
 * Questionnaires ouverts par le formateur au fil du cours (novembre 2026, POEI
 * Chamas Tacos : un quiz par demi-journée, à passer quand le cours en est là).
 *
 * Un questionnaire rattaché à une session sans date d'ouverture
 * (qcm_sessions.date_ouverture vide) est fermé : le stagiaire ne le voit pas et
 * ne peut pas le soumettre. Le formateur l'ouvre depuis son espace, ou en
 * l'envoyant aux stagiaires. Les autres rattachements sont ouverts dès leur
 * création (valeur par défaut de la colonne).
 *
 * Une réponse porte normalement son rattachement (qcm_reponses.qcm_session_id).
 * Sans lui, c'est le rattachement du même questionnaire à la même session qui
 * fait foi ; sans rattachement du tout (anciennes données), elle reste visible.
 */

type ReponseLiee = { qcm_session_id?: string | null; session_id?: string | null; qcm_id?: string | null }

export function estOuvert(dateOuverture: string | null | undefined, maintenant = new Date()): boolean {
  return !!dateOuverture && new Date(dateOuverture) <= maintenant
}

const paire = (sessionId: string, qcmId: string) => `${sessionId}|${qcmId}`

/** Les réponses dont le questionnaire est ouvert (celles sans rattachement comprises). */
export async function reponsesOuvertes<T extends ReponseLiee>(supabase: any, reponses: T[]): Promise<T[]> {
  const ids = Array.from(new Set(reponses.map((r) => r.qcm_session_id).filter(Boolean))) as string[]
  const sansLien = reponses.filter((r) => !r.qcm_session_id && r.session_id && r.qcm_id)
  if (!ids.length && !sansLien.length) return reponses

  const fermes = new Set<string>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('qcm_sessions').select('id, date_ouverture').in('id', ids.slice(i, i + 150))
    for (const q of (data || []) as any[]) if (!estOuvert(q.date_ouverture)) fermes.add(q.id)
  }

  // Sans rattachement sur la réponse : fermée si le questionnaire est rattaché
  // à la session et qu'aucun de ses rattachements n'est ouvert
  const pairesFermees = new Set<string>()
  if (sansLien.length) {
    const sessions = Array.from(new Set(sansLien.map((r) => r.session_id as string)))
    const qcms = Array.from(new Set(sansLien.map((r) => r.qcm_id as string)))
    const ouvertes = new Set<string>()
    const vues = new Set<string>()
    for (let i = 0; i < sessions.length; i += 100) {
      const { data } = await supabase.from('qcm_sessions').select('session_id, qcm_id, date_ouverture')
        .in('session_id', sessions.slice(i, i + 100)).in('qcm_id', qcms)
      for (const l of (data || []) as any[]) {
        const k = paire(l.session_id, l.qcm_id)
        vues.add(k)
        if (estOuvert(l.date_ouverture)) ouvertes.add(k)
      }
    }
    for (const k of vues) if (!ouvertes.has(k)) pairesFermees.add(k)
  }

  return reponses.filter((r) => r.qcm_session_id
    ? !fermes.has(r.qcm_session_id)
    : !(r.session_id && r.qcm_id && pairesFermees.has(paire(r.session_id, r.qcm_id))))
}

/** Le questionnaire de cette réponse est-il ouvert ? (sans rattachement : oui) */
export async function reponseOuverte(supabase: any, reponse: ReponseLiee): Promise<boolean> {
  return (await reponsesOuvertes(supabase, [reponse])).length === 1
}
