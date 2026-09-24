'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

/**
 * Rapport de fin de session du formateur (espace connecté) : brouillon
 * enregistrable, puis transmission au gestionnaire — le rapport transmis
 * apparaît sur la fiche session du dashboard et notifie l'équipe.
 */
export async function enregistrerRapportAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: formateur } = await supabase.from('formateurs')
    .select('id, prenom, nom').eq('user_id', session.user.id).single()
  if (!formateur) return { success: false, error: 'Fiche formateur introuvable' }

  const sessionId = String(formData.get('session_id') || '')
  const transmettre = formData.get('transmettre') === 'true'

  // La session doit être à ce formateur.
  const { data: sess } = await supabase.from('sessions')
    .select('id, reference, intitule, formation:formation_id(intitule)')
    .eq('id', sessionId).eq('formateur_id', formateur.id)
    .eq('organization_id', session.organization.id).maybeSingle()
  if (!sess) return { success: false, error: 'Session introuvable' }

  const champ = (n: string) => String(formData.get(n) || '').trim() || null
  const donnees = {
    organization_id: session.organization.id,
    session_id: sessionId,
    formateur_id: formateur.id,
    contenu_aborde: champ('contenu_aborde'),
    objectifs_atteints: champ('objectifs_atteints'),
    objectifs_non_atteints: champ('objectifs_non_atteints'),
    difficultes_rencontrees: champ('difficultes_rencontrees'),
    recommandations: champ('recommandations'),
    points_positifs: champ('points_positifs'),
    commentaires_generaux: champ('commentaires_generaux'),
    status: transmettre ? 'soumis' : 'brouillon',
    submitted_at: transmettre ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  // Un rapport déjà transmis ne se réécrit pas depuis l'espace formateur.
  const { data: existant } = await supabase.from('rapports_session')
    .select('id, status').eq('session_id', sessionId).eq('formateur_id', formateur.id).maybeSingle()
  if (existant?.status === 'soumis' || existant?.status === 'valide') {
    return { success: false, error: 'Ce rapport a déjà été transmis.' }
  }

  const { error } = existant
    ? await supabase.from('rapports_session').update(donnees).eq('id', existant.id)
    : await supabase.from('rapports_session').insert(donnees)
  if (error) { console.error('[rapport session]', error.message); return { success: false, error: 'Enregistrement impossible' } }

  if (transmettre) {
    // Notifier les gestionnaires : le rapport est arrivé.
    const { createNotifications } = await import('@/lib/email')
    const { data: equipe } = await supabase.from('users')
      .select('id').eq('organization_id', session.organization.id)
      .in('role', ['super_admin', 'gestionnaire'])
    const intitule = (sess as any).formation?.intitule || (sess as any).intitule || (sess as any).reference || 'la session'
    await createNotifications((equipe || []).map((u: any) => ({
      organizationId: session.organization.id,
      userId: u.id,
      titre: 'Rapport de session transmis',
      message: `${formateur.prenom} ${formateur.nom} a transmis son rapport pour « ${intitule} »${(sess as any).reference ? ` (${(sess as any).reference})` : ''}.`,
      type: 'info',
      lienUrl: `/dashboard/sessions/${sessionId}?tab=rapport`,
      lienLabel: 'Voir la session',
      entityType: 'session',
      entityId: sessionId,
    })))
  }

  revalidatePath('/mon-espace/sessions')
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}
