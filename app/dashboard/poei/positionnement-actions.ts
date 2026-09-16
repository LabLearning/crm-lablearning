'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'
import { evaluerPositionnement, QUESTIONS, type NiveauReponse, type Reponses } from '@/lib/poei-positionnement'

const MESSAGE_MIGRATION =
  'Appliquez la migration 152 pour enregistrer les positionnements POEI.'

const tableAbsente = (e: any) => ['PGRST205', '42P01'].includes(String(e?.code))

function canManage(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial', 'formateur'].includes(role)
}

/** Lit les réponses du formulaire, une par question du référentiel. */
function lireReponses(formData: FormData): Reponses {
  const reponses: Reponses = {}
  for (const q of QUESTIONS) {
    const v = formData.get(q.code)
    if (v === null || v === '') continue
    const n = Number(v)
    if (Number.isInteger(n) && n >= 0 && n <= 3) reponses[q.code] = n as NiveauReponse
  }
  return reponses
}

/**
 * Enregistre le positionnement d'un candidat. Les résultats sont calculés ici
 * et figés : le document remis à France Travail ne doit pas changer si le
 * barème évolue plus tard.
 */
export async function enregistrerPositionnementAction(
  poeiId: string,
  candidatId: string,
  formData: FormData,
): Promise<ActionResult<{ maitrise: number; heures: number }>> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: candidat } = await supabase
    .from('poei_candidats').select('id, poei_id')
    .eq('id', candidatId).eq('poei_id', poeiId).eq('organization_id', orgId).maybeSingle()
  if (!candidat) return { success: false, error: 'Candidat introuvable' }

  const reponses = lireReponses(formData)
  if (Object.keys(reponses).length === 0) {
    return { success: false, error: 'Répondez au moins à une situation avant d\'enregistrer' }
  }
  const resultat = evaluerPositionnement(reponses)

  const { error } = await supabase.from('poei_positionnements').upsert({
    organization_id: orgId,
    poei_id: poeiId,
    candidat_id: candidatId,
    reponses,
    resultats: resultat,
    maitrise_globale: resultat.maitriseGlobale,
    heures_preconisees: resultat.heuresPreconisees,
    heures_referentiel: resultat.heuresReferentiel,
    niveau: resultat.niveau,
    realise_le: (formData.get('realise_le') as string) || new Date().toISOString().slice(0, 10),
    realise_par: session.user.id,
    commentaire: ((formData.get('commentaire') as string) || '').trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'candidat_id' })

  if (error) {
    if (tableAbsente(error)) return { success: false, error: MESSAGE_MIGRATION }
    console.error('[positionnement POEI]', error)
    return { success: false, error: 'Enregistrement impossible' }
  }

  await logAudit({
    action: 'positionnement', entity_type: 'poei_candidat', entity_id: candidatId,
    details: { maitrise: resultat.maitriseGlobale, heures: resultat.heuresPreconisees },
  })
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true, data: { maitrise: resultat.maitriseGlobale, heures: resultat.heuresPreconisees } }
}

/** Supprime le positionnement d'un candidat. */
export async function supprimerPositionnementAction(poeiId: string, candidatId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('poei_positionnements').delete()
    .eq('candidat_id', candidatId).eq('poei_id', poeiId).eq('organization_id', session.organization.id)
  if (error) {
    if (tableAbsente(error)) return { success: false, error: MESSAGE_MIGRATION }
    return { success: false, error: 'Suppression impossible' }
  }
  revalidatePath(`/dashboard/poei/${poeiId}`)
  return { success: true }
}
