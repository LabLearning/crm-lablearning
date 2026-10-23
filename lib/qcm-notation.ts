/**
 * Notation et enregistrement d'un questionnaire rempli.
 *
 * La logique était jusqu'ici enfermée dans l'action du portail apprenant. Elle
 * sert désormais à deux appelants — le stagiaire qui répond lui-même, et le
 * gestionnaire qui reporte un entretien conduit oralement — et un score doit
 * se calculer de la même façon quel que soit le chemin.
 */

export interface ResultatNotation {
  score: number | null
  scorePoints: number
  scoreTotal: number
  isReussi: boolean | null
}

/**
 * Calcule le score, enregistre le détail des réponses et clôt le
 * questionnaire.
 */
export async function enregistrerReponses(
  supabase: any,
  qcmReponseId: string,
  qcmId: string,
  reponses: Record<string, string>,
): Promise<{ success: boolean; error?: string; data?: ResultatNotation }> {
  const { data: questions } = await supabase
    .from('qcm_questions')
    .select('id, texte, type, points, choix:qcm_choix(id, texte, est_correct, position)')
    .eq('qcm_id', qcmId)
    .order('position', { ascending: true })

  if (!questions) return { success: false, error: 'Impossible de charger les questions' }

  let pointsObtenusTotal = 0
  let pointsPossibles = 0
  const details: any[] = []
  // Un positionnement ou une satisfaction n'a pas de bonne réponse : il n'y a
  // rien à noter, mais les échelles disent quelque chose. On les moyenne.
  let notesCumul = 0
  let notesNombre = 0
  let notesMax = 0
  let questionNotable = false

  for (const q of questions as any[]) {
    const pts = Number(q.points) || 1
    const reponse = reponses[q.id]

    let estCorrect: boolean | null = null
    let pointsObtenus = 0
    let choixIds: string[] | null = null
    let texteLibre: string | null = null
    let note: number | null = null

    if (q.type === 'choix_unique' || q.type === 'choix_multiple' || q.type === 'vrai_faux') {
      // Seule une question avec une bonne réponse définie entre dans le
      // dénominateur : une échelle ou un texte libre au milieu d'un QCM ne
      // doit pas diluer le pourcentage de bonnes réponses.
      if ((q.choix as any[])?.some((c: any) => c.est_correct === true)) {
        questionNotable = true
        pointsPossibles += pts
      }
      if (reponse) {
        choixIds = [reponse]
        const choix = (q.choix as any[]).find((c: any) => c.id === reponse)
        if (choix) {
          estCorrect = choix.est_correct === true
          if (estCorrect) { pointsObtenusTotal += pts; pointsObtenus = pts }
        }
      }
    } else if (q.type === 'texte_libre') {
      // Une réponse ouverte ne se note pas automatiquement.
      texteLibre = reponse || null
    } else {
      // Échelles et NPS : une satisfaction n'est ni juste ni fausse. Une note
      // hors de l'échelle (envoyée hors du formulaire, qui ne propose que
      // plancher..plafond) est ignorée : elle fausserait toutes les moyennes.
      const plafond = q.type === 'note_1_5' ? 5 : 10
      const plancher = q.type === 'nps' ? 0 : 1
      const lue = reponse ? parseInt(reponse, 10) : NaN
      note = Number.isInteger(lue) && lue >= plancher && lue <= plafond ? lue : null
      if (note != null) { notesCumul += note; notesNombre++; notesMax += plafond }
    }

    details.push({
      reponse_id: qcmReponseId,
      question_id: q.id,
      choix_ids: choixIds,
      texte_libre: texteLibre,
      note_valeur: note,
      est_correct: estCorrect,
      points_obtenus: pointsObtenus,
    })
  }

  // Trois cas, et un seul chiffre affiché :
  //   des questions notables  -> pourcentage de bonnes réponses ;
  //   que des échelles        -> moyenne des notes, ramenée sur 100 ;
  //   que du texte libre      -> aucun score, et surtout pas zéro, qui se
  //                              lirait comme un échec.
  const score = questionNotable && pointsPossibles > 0
    ? Math.round((pointsObtenusTotal / pointsPossibles) * 100)
    : notesNombre > 0 && notesMax > 0
      ? Math.round((notesCumul / notesMax) * 100)
      : null

  const { data: qcm } = await supabase.from('qcm').select('score_min_reussite').eq('id', qcmId).single()
  const seuil = qcm?.score_min_reussite != null ? Number(qcm.score_min_reussite) : null
  // Sans questions notables, la notion de réussite ne s'applique pas.
  const isReussi = questionNotable && seuil !== null && score !== null ? score >= seuil : null

  if (details.length > 0) {
    await supabase.from('qcm_reponses_detail').insert(details)
  }

  const maj = {
    score,
    score_points: questionNotable ? pointsObtenusTotal : null,
    score_total: questionNotable ? pointsPossibles : null,
    is_reussi: isReussi,
    is_complete: true,
    completed_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('qcm_reponses').update(maj).eq('id', qcmReponseId)
  if (error) {
    console.error('[notation qcm]', error.message)
    return { success: false, error: "Enregistrement impossible" }
  }

  return { success: true, data: { score, scorePoints: pointsObtenusTotal, scoreTotal: pointsPossibles, isReussi } }
}
