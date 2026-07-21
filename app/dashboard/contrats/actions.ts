'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

/** (Re)envoie un contrat de prestation au formateur pour signature */
export async function resendContratSignatureAction(contratId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: contrat } = await supabase
    .from('contrats_formateur')
    .select('id, organization_id')
    .eq('id', contratId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!contrat) return { success: false, error: 'Contrat introuvable' }

  const { sendContratForSignature } = await import('@/lib/contrat-formateur')
  const res = await sendContratForSignature(supabase, contratId)
  if (!res.success) return { success: false, error: res.error }

  await logAudit({ action: 'resend_contrat_signature', entity_type: 'contrat_formateur', entity_id: contratId })
  revalidatePath('/dashboard/contrats')
  revalidatePath('/dashboard/sessions')
  return { success: true }
}

/** Renvoie une copie du contrat signé au formateur et à l'organisme */
export async function resendSignedContratAction(contratId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: contrat } = await supabase
    .from('contrats_formateur')
    .select('id, signature_formateur_date')
    .eq('id', contratId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!contrat) return { success: false, error: 'Contrat introuvable' }
  if (!contrat.signature_formateur_date) return { success: false, error: 'Ce contrat n\'est pas encore signé' }

  try {
    const { sendSignedContratCopies } = await import('@/lib/contrat-formateur')
    await sendSignedContratCopies(supabase, contratId)
  } catch {
    return { success: false, error: 'Envoi impossible' }
  }

  await logAudit({ action: 'resend_contrat_signe', entity_type: 'contrat_formateur', entity_id: contratId })
  return { success: true }
}
