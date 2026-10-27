'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

/**
 * Enregistre / met à jour le recueil du besoin d'une session (indicateur 4).
 * Un seul recueil par session (upsert sur organization_id + session_id).
 */
export async function saveRecueilAction(params: {
  sessionId: string
  templateId: string | null
  theme: string | null
  reponses: Record<string, string>
  statut: 'brouillon' | 'complete'
}): Promise<ActionResult> {
  const session = await getSession()
  if (['formateur', 'apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  // La date du recueil est calée à J-7 du début de la session — c'est la
  // chronologie attendue (analyse du besoin en amont de la formation). Une
  // fois posée, elle ne bouge plus : les mises à jour du contenu ne
  // réécrivent jamais la date d'origine.
  const [{ data: existant }, { data: sess }] = await Promise.all([
    supabase.from('recueils_besoin').select('date_recueil')
      .eq('organization_id', session.organization.id).eq('session_id', params.sessionId).maybeSingle(),
    supabase.from('sessions').select('date_debut').eq('id', params.sessionId).maybeSingle(),
  ])
  let dateRecueil: string | null = (existant as any)?.date_recueil || null
  if (!dateRecueil && params.statut === 'complete') {
    if ((sess as any)?.date_debut) {
      const d = new Date((sess as any).date_debut)
      d.setDate(d.getDate() - 7)
      dateRecueil = d.toISOString().split('T')[0]
    } else {
      dateRecueil = new Date().toISOString().split('T')[0]
    }
  }

  const { error } = await supabase.from('recueils_besoin').upsert({
    organization_id: session.organization.id,
    session_id: params.sessionId,
    template_id: params.templateId || null,
    theme: params.theme || null,
    reponses: params.reponses || {},
    statut: params.statut,
    rempli_par: session.user.id,
    date_recueil: dateRecueil,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,session_id' })

  if (error) { console.error('[recueil]', error); return { success: false, error: 'Erreur lors de l\'enregistrement' } }

  await logAudit({ action: 'save', entity_type: 'recueil_besoin', entity_id: params.sessionId, details: { statut: params.statut } })
  revalidatePath(`/dashboard/sessions/${params.sessionId}`)
  revalidatePath('/dashboard/qualiopi')
  return { success: true }
}

/**
 * Réponses automatiques de la session, sans rien enregistrer : l'onglet
 * Recueil les place dans les champs vides, la personne relit puis enregistre
 * (utile pour une session déjà commencée, que le CRM ne remplit pas seul).
 */
export async function reponsesAutoRecueilAction(sessionId: string, theme: string | null): Promise<ActionResult<{ theme: string; reponses: Record<string, string> }>> {
  const session = await getSession()
  if (['formateur', 'apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) return { success: false, error: 'Session introuvable' }
  const supabase = await createServiceRoleClient()
  const { reponsesAutomatiquesDeSession } = await import('@/lib/recueil-auto-serveur')
  const r = await reponsesAutomatiquesDeSession(supabase, session.organization.id, sessionId, typeof theme === 'string' ? theme : null)
  if (!r) return { success: false, error: 'Session ou modèle de recueil introuvable' }
  return { success: true, data: r }
}
