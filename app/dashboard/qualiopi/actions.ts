'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import type { ConformiteNiveau } from '@/lib/types/qualiopi'

export async function initQualiopiAction(): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Check if already seeded
  const { count } = await supabase
    .from('qualiopi_indicateurs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', session.organization.id)

  if (count && count > 0) return { success: true }

  const { error } = await supabase.rpc('seed_qualiopi_indicateurs', { org_id: session.organization.id })
  if (error) {
    console.error('[Init Qualiopi]', error)
    return { success: false, error: 'Erreur lors de l\'initialisation' }
  }

  revalidatePath('/dashboard/qualiopi')
  return { success: true }
}

export async function updateIndicateurAction(
  id: string,
  niveau: ConformiteNiveau,
  commentaire: string
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('qualiopi_indicateurs')
    .update({
      niveau,
      commentaire: commentaire || null,
      date_evaluation: new Date().toISOString().split('T')[0],
      evalue_par: session.user.id,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'evaluate', entity_type: 'qualiopi_indicateur', entity_id: id, details: { niveau } })
  revalidatePath('/dashboard/qualiopi')
  return { success: true }
}

export async function addPreuveAction(indicateurId: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const titre = formData.get('titre') as string
  const description = formData.get('description') as string
  const type = formData.get('type') as string || 'document'
  const lien_externe = formData.get('lien_externe') as string

  if (!titre) return { success: false, error: 'Titre requis' }

  const { error } = await supabase.from('qualiopi_preuves').insert({
    organization_id: session.organization.id,
    indicateur_id: indicateurId,
    titre,
    description: description || null,
    type,
    lien_externe: lien_externe || null,
    created_by: session.user.id,
  })

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qualiopi')
  return { success: true }
}

export async function removePreuveAction(preuveId: string): Promise<ActionResult> {
  // Une Server Action est une API publique : sans ce contrôle, un anonyme
  // connaissant l'UUID pouvait supprimer une preuve de conformité Qualiopi.
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  // La preuve doit appartenir à l'organisation de l'utilisateur
  const { data: preuve } = await supabase
    .from('qualiopi_preuves')
    .select('document_url')
    .eq('id', preuveId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!preuve) return { success: false, error: 'Preuve introuvable' }
  if (preuve.document_url && !/^https?:\/\//.test(preuve.document_url)) {
    await supabase.storage.from('dossiers').remove([preuve.document_url])
  }
  const { error } = await supabase
    .from('qualiopi_preuves').delete()
    .eq('id', preuveId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/qualiopi')
  return { success: true }
}
