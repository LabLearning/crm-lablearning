'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ETAPES_PAR_CLE, DPO_VERSION } from '@/lib/dpo'
import { refusSignature } from '@/lib/signature-image'
import type { ActionResult } from '@/lib/types'

const STATUTS = ['a_faire', 'fait', 'non_applicable']

/**
 * Valide (ou dévalide) une étape du déroulé opérationnel sur une session.
 * Accessible au formateur de la session et à l'équipe interne.
 */
export async function validerEtapeDerouleAction(
  sessionId: string,
  etapeCle: string,
  statut: string,
  commentaire?: string,
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  if (!ETAPES_PAR_CLE[etapeCle]) return { success: false, error: 'Étape inconnue' }
  if (!STATUTS.includes(statut)) return { success: false, error: 'Statut invalide' }

  const { data: sess } = await supabase
    .from('sessions')
    .select('id, organization_id, formateur_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (!sess || sess.organization_id !== session.organization.id) {
    return { success: false, error: 'Session introuvable' }
  }

  // Un formateur ne valide que ses propres sessions.
  if (session.user.role === 'formateur') {
    const { data: f } = await supabase.from('formateurs').select('id').eq('user_id', session.user.id).maybeSingle()
    if (!f || f.id !== sess.formateur_id) return { success: false, error: 'Cette session ne vous est pas rattachée' }
  }

  const { error } = await supabase.from('session_deroule_etapes').upsert({
    organization_id: session.organization.id,
    session_id: sessionId,
    etape_cle: etapeCle,
    statut,
    commentaire: commentaire?.trim() || null,
    validated_by: session.user.id,
    validated_at: statut === 'a_faire' ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'session_id,etape_cle' })

  if (error) {
    console.error('[valider etape deroule]', error)
    if ((error as any).code === '42P01') {
      return { success: false, error: 'Table absente : appliquer la migration 119_deroule_operationnel.sql' }
    }
    return { success: false, error: "Enregistrement impossible" }
  }

  await logAudit({ action: 'update', entity_type: 'session_deroule', entity_id: sessionId, details: { etape: etapeCle, statut } })
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  revalidatePath(`/mon-espace/sessions/${sessionId}`)
  return { success: true }
}

/** Le formateur signe son engagement sur le déroulé opérationnel. */
export async function signerDpoAction(signatureData: string): Promise<ActionResult> {
  // Un cadre validé sans tracé n'est pas une signature
  const refus = refusSignature(signatureData)
  if (refus) return { success: false, error: refus }

  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: f } = await supabase
    .from('formateurs').select('id').eq('user_id', session.user.id).maybeSingle()
  if (!f) return { success: false, error: 'Aucune fiche formateur rattachée à votre compte' }

  const { error } = await supabase.from('dpo_signatures').upsert({
    organization_id: session.organization.id,
    formateur_id: f.id,
    version: DPO_VERSION,
    signature_data: signatureData,
    signed_at: new Date().toISOString(),
  }, { onConflict: 'formateur_id,version' })

  if (error) {
    console.error('[signer dpo]', error)
    if ((error as any).code === '42P01') {
      return { success: false, error: 'Table absente : appliquer la migration 119_deroule_operationnel.sql' }
    }
    return { success: false, error: 'Signature non enregistrée' }
  }

  await logAudit({ action: 'sign', entity_type: 'dpo', entity_id: f.id, details: { version: DPO_VERSION } })
  revalidatePath('/mon-espace')
  revalidatePath('/mon-espace/deroule')
  return { success: true }
}
