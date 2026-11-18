'use server'

import { getOptionalSession } from '@/lib/auth'
import { QUESTIONNAIRES, evaluerPositionnement, nettoyerReponses, type CodeQuestionnaire, type Reponses } from '@/lib/poei-positionnement'
import { ROLES_APERCU } from './roles'

/** Résultat d'un essai en aperçu, avec la correction des réponses fausses */
export interface CorrectionApercu {
  justes: number
  total: number
  note: number
  maitrise: number
  niveau: string
  seuilAtteint: boolean
  seuil: number
  heures: number
  duree: number
  domaines: { libelle: string; justes: number; total: number }[]
  erreurs: { numero: number; competence: string | null; intitule: string; repondu: string | null; attendu: string; explication: string }[]
}

/**
 * Corrige un essai fait en aperçu par l'équipe, pour qu'elle voie le résultat
 * qu'obtiendrait un candidat. Rien n'est enregistré. Les bonnes réponses ne
 * quittent le serveur qu'ici, après les réponses, et pour l'équipe connectée.
 */
export async function corrigerApercuAction(code: string, reponses: Reponses): Promise<{ success: boolean; error?: string; data?: CorrectionApercu }> {
  const user = await getOptionalSession()
  if (!user || !ROLES_APERCU.includes(user.role)) return { success: false, error: 'Connexion requise' }
  const q = QUESTIONNAIRES[code as CodeQuestionnaire]
  if (!q) return { success: false, error: 'Questionnaire inconnu' }

  const propres = nettoyerReponses(q, reponses || {})
  const r = evaluerPositionnement(propres, q)
  return {
    success: true,
    data: {
      justes: r.justes,
      total: r.nbQuestions,
      note: r.note,
      maitrise: r.maitriseGlobale,
      niveau: r.niveauLibelle,
      seuilAtteint: r.seuilAtteint,
      seuil: r.seuil,
      heures: r.heuresPreconisees,
      duree: r.dureeParcours,
      domaines: q.domaines.map((d) => {
        const dom = r.domaines.find((x) => x.code === d.code)
        return { libelle: d.libelle, justes: dom?.justes ?? 0, total: dom?.total ?? 0 }
      }),
      erreurs: q.questions
        .map((x, i) => ({ x, i }))
        .filter(({ x }) => propres[x.code] == null || Number(propres[x.code]) !== x.correct)
        .map(({ x, i }) => ({
          numero: i + 1,
          competence: x.competence || null,
          intitule: x.intitule,
          repondu: propres[x.code] != null ? x.choix[Number(propres[x.code])] : null,
          attendu: x.choix[x.correct],
          explication: x.explication,
        })),
    },
  }
}
