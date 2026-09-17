'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { QUESTIONS_FORMATEUR } from '@/lib/evaluation-formateur-referent'

/**
 * Dépôt public de l'évaluation d'un formateur par le référent. Le jeton (UUID
 * non devinable reçu par email) identifie la demande ; une demande déjà
 * répondue n'est pas écrasée.
 */
export async function deposerEvaluationFormateurAction(token: string, formData: FormData): Promise<ActionResult> {
  if (String(formData.get('site_web') || '').trim() !== '') return { success: true }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { success: false, error: 'Lien invalide' }

  const supabase = await createServiceRoleClient()
  const { data: demande } = await supabase
    .from('appreciations_parties_prenantes')
    .select('id, statut').eq('token', token).eq('type', 'evaluation_formateur').maybeSingle()
  if (!demande) return { success: false, error: 'Lien invalide' }
  if ((demande as any).statut === 'repondu') return { success: false, error: 'Cette évaluation a déjà été enregistrée.' }

  const note = (champ: string) => {
    const v = Number(formData.get(champ))
    return v >= 1 && v <= 5 ? v : null
  }
  if (!note('note_globale')) return { success: false, error: 'Merci d’indiquer au moins l’appréciation globale.' }

  // Les remarques sont obligatoires : une note seule ne dit pas quoi améliorer
  const commentaire = String(formData.get('commentaire') || '').trim().slice(0, 3000)
  if (commentaire.length < 20) {
    return { success: false, error: 'Merci d’écrire quelques phrases dans « Vos remarques » : elles comptent autant que les notes.' }
  }

  const notes: Record<string, number | null> = {}
  for (const q of QUESTIONS_FORMATEUR) notes[q.cle] = note(q.cle)

  const { error } = await supabase.from('appreciations_parties_prenantes').update({
    ...notes,
    note_globale: note('note_globale'),
    // Les colonnes historiques restent renseignées pour les tableaux de bord
    note_intervenant: note('note_globale'),
    recommande: formData.get('recommande') === 'oui' ? true : formData.get('recommande') === 'non' ? false : null,
    commentaire,
    repondant_nom: String(formData.get('nom') || '').trim().slice(0, 120) || null,
    repondant_fonction: String(formData.get('fonction') || '').trim().slice(0, 120) || null,
    repondant_email: String(formData.get('email') || '').trim().slice(0, 200) || null,
    statut: 'repondu',
    repondu_at: new Date().toISOString(),
  }).eq('id', (demande as any).id)
  if (error) {
    console.error('[évaluation formateur publique]', error)
    return { success: false, error: 'Une erreur est survenue — vous pouvez nous écrire à digital@lab-learning.fr.' }
  }
  return { success: true }
}
