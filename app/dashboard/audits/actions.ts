'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { generateApiKey } from '@/lib/api-keys'

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string }

// ════════════════════════════════════════════════════════════
// AUDITS
// ════════════════════════════════════════════════════════════

export async function createAuditAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const clientId = formData.get('client_id') as string
  if (!clientId) return { success: false, error: 'Établissement requis' }

  // Récupérer la franchise du client
  const { data: client } = await supabase
    .from('clients')
    .select('franchise_id')
    .eq('id', clientId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!client) return { success: false, error: 'Établissement introuvable' }

  const noteSur = parseInt((formData.get('note_sur') as string) || '20')
  const noteRaw = formData.get('note_globale') as string
  const noteGlobale = noteRaw ? parseFloat(noteRaw) : null

  const { data, error } = await supabase
    .from('audits_etablissement')
    .insert({
      organization_id: session.organization.id,
      client_id: clientId,
      franchise_id: client.franchise_id,
      session_id: (formData.get('session_id') as string) || null,
      date_audit: (formData.get('date_audit') as string) || new Date().toISOString().split('T')[0],
      type_audit: (formData.get('type_audit') as string) || 'hygiene',
      note_globale: noteGlobale,
      note_sur: noteSur,
      points_forts: (formData.get('points_forts') as string) || null,
      points_amelioration: (formData.get('points_amelioration') as string) || null,
      bilan: (formData.get('bilan') as string) || null,
      commentaires: (formData.get('commentaires') as string) || null,
      auteur_id: session.user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'create', entity_type: 'audit_etablissement', entity_id: data.id })
  revalidatePath('/dashboard/audits')
  return { success: true, data }
}

export async function updateAuditAction(id: string, formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updates: Record<string, unknown> = {}
  if (formData.has('date_audit')) updates.date_audit = formData.get('date_audit')
  if (formData.has('type_audit')) updates.type_audit = formData.get('type_audit')
  if (formData.has('note_sur')) updates.note_sur = parseInt(formData.get('note_sur') as string) || 20
  if (formData.has('note_globale')) {
    const v = formData.get('note_globale') as string
    updates.note_globale = v ? parseFloat(v) : null
  }
  if (formData.has('points_forts')) updates.points_forts = (formData.get('points_forts') as string) || null
  if (formData.has('points_amelioration')) updates.points_amelioration = (formData.get('points_amelioration') as string) || null
  if (formData.has('bilan')) updates.bilan = (formData.get('bilan') as string) || null
  if (formData.has('commentaires')) updates.commentaires = (formData.get('commentaires') as string) || null

  const { error } = await supabase
    .from('audits_etablissement')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/audits')
  return { success: true }
}

export async function deleteAuditAction(id: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('audits_etablissement')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/audits')
  return { success: true }
}

// ════════════════════════════════════════════════════════════
// CLÉS API
// ════════════════════════════════════════════════════════════

/** Crée une clé API. La clé complète n'est retournée qu'ici (une seule fois). */
export async function createApiKeyAction(name: string): Promise<Result<{ key: string; prefix: string }>> {
  const session = await getSession()
  if (session.user.role !== 'super_admin' && session.user.role !== 'gestionnaire') {
    return { success: false, error: 'Accès réservé aux administrateurs' }
  }
  const supabase = await createServiceRoleClient()

  const { full, prefix, hash } = generateApiKey()

  const { error } = await supabase.from('api_keys').insert({
    organization_id: session.organization.id,
    name: name.trim() || 'Clé API',
    key_prefix: prefix,
    key_hash: hash,
    scopes: ['audits:write'],
    created_by: session.user.id,
  })
  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'create', entity_type: 'api_key', entity_id: prefix })
  revalidatePath('/dashboard/audits')
  return { success: true, data: { key: full, prefix } }
}

export async function revokeApiKeyAction(id: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/audits')
  return { success: true }
}
