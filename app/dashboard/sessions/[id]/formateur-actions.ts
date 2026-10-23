'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { peutGererSessions, ROLES_REMUNERATION_FORMATEUR } from '@/lib/sessions-acces'
import type { ActionResult } from '@/lib/types'

/**
 * Onglet « Formateur » de la session : changer (ou affecter) le formateur sans
 * passer par « Modifier la session ».
 *
 * Comme toute action exportée d'un module 'use server', elle est joignable hors
 * du tableau de bord : elle vérifie elle-même le rôle (personnel qui gère les
 * sessions, jamais un compte externe) et que la session comme le formateur
 * appartiennent à l'organisme.
 *
 * `mission` :
 *  - 'proposer' : comme depuis « Modifier la session », la mission est proposée
 *    au formateur (e-mail et notification), il l'accepte depuis son espace et
 *    son contrat part à l'acceptation ;
 *  - 'acceptee' : il a déjà donné son accord hors du CRM. Aucun e-mail ne part,
 *    la mission est notée acceptée, le contrat s'envoie depuis l'onglet.
 *
 * `coutFormateur` (€ HT, null pour « à définir ») n'est pris en compte que pour
 * les rôles qui fixent la rémunération ; absent, elle ne change pas.
 */
export async function changerFormateurSessionAction(
  sessionId: string,
  formateurId: string,
  options: { mission: 'proposer' | 'acceptee'; coutFormateur?: number | null },
): Promise<ActionResult<{ email: string | null; contratsAnnules: number }>> {
  const session = await getSession()
  if (!peutGererSessions(session, 'update')) {
    return { success: false, error: "Vous n'avez pas le droit de changer le formateur de cette session" }
  }
  if (typeof sessionId !== 'string' || !sessionId || typeof formateurId !== 'string' || !formateurId) {
    return { success: false, error: 'Choisissez un formateur' }
  }
  const mission = options?.mission === 'acceptee' ? 'acceptee' : 'proposer'
  const fixeRemuneration = ROLES_REMUNERATION_FORMATEUR.includes(session.user.role) && options?.coutFormateur !== undefined
  const cout = fixeRemuneration && options.coutFormateur != null ? Number(options.coutFormateur) : null
  if (fixeRemuneration && options.coutFormateur != null && (!Number.isFinite(cout) || (cout as number) < 0)) {
    return { success: false, error: 'Rémunération invalide' }
  }

  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const [{ data: sess }, { data: chapeau }, { data: nouveau }] = await Promise.all([
    supabase.from('sessions')
      .select('id, reference, status, formateur_id, cout_formateur, poei_intervention_id')
      .eq('id', sessionId).eq('organization_id', orgId).maybeSingle(),
    supabase.from('poei').select('id').eq('session_id', sessionId).eq('organization_id', orgId).limit(1).maybeSingle(),
    supabase.from('formateurs').select('id, prenom, nom, email, is_active')
      .eq('id', formateurId).eq('organization_id', orgId).maybeSingle(),
  ])
  if (!sess) return { success: false, error: 'Session introuvable' }
  // Une POEI n'a qu'un support technique de session : son formateur se choisit sur chaque intervention
  if ((sess as any).poei_intervention_id || chapeau) {
    return { success: false, error: "Le formateur d'une POEI se choisit sur ses interventions, depuis la fiche POEI" }
  }
  if (!nouveau) return { success: false, error: 'Formateur introuvable' }
  if (!(nouveau as any).is_active) {
    return { success: false, error: 'Ce formateur est désactivé : réactivez sa fiche avant de lui confier une mission' }
  }
  if (sess.formateur_id === formateurId) return { success: false, error: 'Ce formateur anime déjà cette session' }

  const maintenant = new Date().toISOString()
  const coutApres = fixeRemuneration ? (cout == null ? null : Math.round(cout * 100) / 100) : sess.cout_formateur
  const { data: maj, error } = await supabase
    .from('sessions')
    .update({
      formateur_id: formateurId,
      mission_status: mission === 'acceptee' ? 'accepted' : 'pending',
      mission_proposed_at: maintenant,
      mission_proposed_by: session.user.id,
      mission_responded_at: mission === 'acceptee' ? maintenant : null,
      // Le motif d'un refus précédent appartient à l'ancienne proposition (il reste au journal)
      mission_response_comment: null,
      ...(fixeRemuneration ? { cout_formateur: coutApres } : {}),
      updated_at: maintenant,
    })
    .eq('id', sessionId)
    .eq('organization_id', orgId)
    .select('id')
  if (error || !maj?.length) return { success: false, error: 'Le changement de formateur a échoué' }

  // Contrats de l'ancien formateur annulés, tâches ouvertes transmises
  let contratsAnnules: { id: string; numero: string | null; signe: boolean }[] = []
  const avertissements: string[] = []
  try {
    const { suitesChangementFormateur } = await import('@/lib/changement-formateur')
    contratsAnnules = (await suitesChangementFormateur(supabase, {
      sessionId, organizationId: orgId, ancienFormateurId: sess.formateur_id, nouveauFormateurId: formateurId,
    })).contratsAnnules
  } catch (e) {
    console.error('[changement de formateur — suites]', e)
    avertissements.push("Le contrat de l'ancien formateur n'a pas pu être annulé : il le sera au premier envoi du contrat au nouveau formateur.")
  }

  // Adresse à laquelle la proposition est réellement partie
  let email: string | null = null
  if (mission === 'proposer') {
    try {
      const { notifyFormateurOfMission } = await import('@/app/dashboard/sessions/actions')
      email = (await notifyFormateurOfMission(formateurId, sessionId))?.emailEnvoye || null
    } catch (e) {
      console.error('[changement de formateur — proposition]', e)
    }
    if (!email && (nouveau as any).email) {
      avertissements.push("L'e-mail de proposition n'a pas pu partir : prévenez le formateur directement. La mission l'attend dans son espace.")
    }
  }

  await logAudit({
    action: 'changer_formateur',
    entity_type: 'session',
    entity_id: sessionId,
    details: {
      reference: sess.reference,
      avant: sess.formateur_id,
      apres: formateurId,
      mission: mission === 'acceptee' ? 'accord_deja_donne' : 'proposee',
      ...(fixeRemuneration ? { cout_formateur: { avant: sess.cout_formateur, apres: coutApres } } : {}),
      contrats_annules: contratsAnnules.map((c) => ({ numero: c.numero, signe: c.signe })),
    },
  })

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  revalidatePath('/dashboard/sessions')
  revalidatePath(`/dashboard/formateurs/${formateurId}`)
  if (sess.formateur_id) revalidatePath(`/dashboard/formateurs/${sess.formateur_id}`)
  revalidatePath('/mon-espace')
  return { success: true, data: { email, contratsAnnules: contratsAnnules.length }, ...(avertissements.length ? { warning: avertissements.join(' ') } : {}) }
}
