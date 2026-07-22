'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Espace documentaire « drive » de la section POEI.
//
// RÈGLE DE SÉCURITÉ (non négociable) : chaque action commence par getSession()
// et ne touche JAMAIS une ressource (dossier / document) sans avoir vérifié
// qu'elle appartient à l'organisation de l'utilisateur. Un `.eq('id', x)` seul
// serait une faille IDOR : on ajoute TOUJOURS `.eq('organization_id', orgId)`.
// ─────────────────────────────────────────────────────────────────────────────

function canManage(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial', 'commercial'].includes(role)
}

export interface DriveDossier {
  id: string
  nom: string
  parent_id: string | null
  client_id: string | null
  created_at: string
}

export interface DriveDocument {
  id: string
  nom: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  storage_path: string | null
  created_at: string
}

/**
 * Contenu d'un niveau du drive : sous-dossiers + documents du dossier courant.
 * `dossierId === null` → racine (dossiers sans parent).
 * Vérifie systématiquement que le dossier parent appartient à l'organisation.
 */
export async function listDossierContent(dossierId: string | null): Promise<ActionResult> {
  const session = await getSession()
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  // Un dossierId fourni doit appartenir à l'organisation avant d'en lister le contenu
  if (dossierId) {
    const { data: current } = await supabase
      .from('documentation_dossiers')
      .select('id')
      .eq('id', dossierId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!current) return { success: false, error: 'Dossier introuvable' }
  }

  // Sous-dossiers du niveau courant — toujours scopés par organisation
  let dossiersQuery = supabase
    .from('documentation_dossiers')
    .select('id, nom, parent_id, client_id, created_at')
    .eq('organization_id', orgId)
    .order('nom', { ascending: true })
  dossiersQuery = dossierId
    ? dossiersQuery.eq('parent_id', dossierId)
    : dossiersQuery.is('parent_id', null)
  const { data: dossiers } = await dossiersQuery

  // Documents rattachés au dossier courant — scopés par organisation
  let documents: DriveDocument[] = []
  if (dossierId) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, nom, file_name, file_size, mime_type, storage_path, created_at')
      .eq('organization_id', orgId)
      .eq('documentation_dossier_id', dossierId)
      .order('created_at', { ascending: false })
    documents = (docs || []) as DriveDocument[]
  }

  return {
    success: true,
    data: { dossiers: (dossiers || []) as DriveDossier[], documents },
  }
}

/**
 * Fil d'Ariane : remonte la chaîne des parents jusqu'à la racine.
 * Borné à 20 niveaux pour éviter une boucle infinie si les données étaient
 * corrompues (cycle parent_id). Chaque saut est scopé par organisation.
 */
export async function getDossierBreadcrumbAction(dossierId: string | null): Promise<ActionResult> {
  const session = await getSession()
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const chain: { id: string; nom: string }[] = []
  let currentId: string | null = dossierId
  let guard = 0
  while (currentId && guard < 20) {
    const { data }: { data: { id: string; nom: string; parent_id: string | null } | null } = await supabase
      .from('documentation_dossiers')
      .select('id, nom, parent_id')
      .eq('id', currentId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!data) break
    chain.unshift({ id: data.id, nom: data.nom })
    currentId = data.parent_id
    guard++
  }

  return { success: true, data: chain }
}

export async function createDossierAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const nom = ((formData.get('nom') as string) || '').trim()
  const parentId = ((formData.get('parent_id') as string) || '').trim() || null
  const clientId = ((formData.get('client_id') as string) || '').trim() || null
  if (!nom) return { success: false, error: 'Nom du dossier requis' }

  // Le parent (sous-dossier) doit appartenir à l'organisation
  if (parentId) {
    const { data: parent } = await supabase
      .from('documentation_dossiers')
      .select('id')
      .eq('id', parentId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!parent) return { success: false, error: 'Dossier parent introuvable' }
  }

  // Le client lié (optionnel) doit appartenir à l'organisation
  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!client) return { success: false, error: 'Client introuvable' }
  }

  const { data, error } = await supabase
    .from('documentation_dossiers')
    .insert({
      organization_id: orgId,
      parent_id: parentId,
      nom,
      client_id: clientId,
      created_by: session.user.id,
    })
    .select('id, nom, parent_id, client_id, created_at')
    .single()
  if (error) return { success: false, error: 'Erreur lors de la création du dossier' }

  await logAudit({ action: 'create', entity_type: 'documentation_dossier', entity_id: data.id })
  revalidatePath('/dashboard/poei')
  return { success: true, data }
}

export async function renameDossierAction(id: string, nom: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const clean = (nom || '').trim()
  if (!clean) return { success: false, error: 'Nom du dossier requis' }

  // .eq('organization_id') garantit qu'on ne renomme qu'un dossier de son org
  const { error } = await supabase
    .from('documentation_dossiers')
    .update({ nom: clean, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: 'Erreur lors du renommage' }

  await logAudit({ action: 'update', entity_type: 'documentation_dossier', entity_id: id })
  revalidatePath('/dashboard/poei')
  return { success: true }
}

/**
 * Supprime un dossier. La cascade en base (ON DELETE CASCADE) supprime les
 * sous-dossiers et les documents rattachés. On vérifie l'appartenance à l'org
 * AVANT toute suppression.
 */
export async function deleteDossierAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const { data: dossier } = await supabase
    .from('documentation_dossiers')
    .select('id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!dossier) return { success: false, error: 'Dossier introuvable' }

  const { error } = await supabase
    .from('documentation_dossiers')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: 'Erreur lors de la suppression' }

  await logAudit({ action: 'delete', entity_type: 'documentation_dossier', entity_id: id })
  revalidatePath('/dashboard/poei')
  return { success: true }
}

/**
 * Enregistre un document (déjà téléversé via /api/documents/upload) dans un
 * dossier du drive. Le dossier cible doit appartenir à l'organisation.
 */
export async function saveDocumentInDossierAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const dossierId = ((formData.get('dossier_id') as string) || '').trim()
  const nom = ((formData.get('nom') as string) || '').trim()
  const storagePath = ((formData.get('storage_path') as string) || '').trim()
  if (!dossierId) return { success: false, error: 'Dossier requis' }
  if (!nom) return { success: false, error: 'Nom du document requis' }
  if (!storagePath) return { success: false, error: 'Fichier requis' }

  // Le dossier de destination doit appartenir à l'organisation
  const { data: dossier } = await supabase
    .from('documentation_dossiers')
    .select('id, client_id')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!dossier) return { success: false, error: 'Dossier introuvable' }

  const fileSize = formData.get('file_size')
  const { data, error } = await supabase
    .from('documents')
    .insert({
      organization_id: orgId,
      documentation_dossier_id: dossierId,
      // Retombe sur le client du dossier pour garder le rattachement CRM cohérent
      client_id: dossier.client_id || null,
      nom,
      type: 'autre',
      storage_path: storagePath,
      file_name: (formData.get('file_name') as string) || null,
      file_size: fileSize ? Number(fileSize) : null,
      mime_type: (formData.get('mime_type') as string) || null,
      created_by: session.user.id,
    })
    .select('id')
    .single()
  if (error) return { success: false, error: 'Erreur lors de l\'enregistrement du document' }

  await logAudit({ action: 'create', entity_type: 'document', entity_id: data.id })
  revalidatePath('/dashboard/poei')
  return { success: true, data }
}

/**
 * Supprime un document du drive. Action locale et sûre : on vérifie
 * explicitement l'appartenance à l'organisation avant de supprimer.
 */
export async function deleteDocumentInDossierAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!canManage(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const supabase = await createServiceRoleClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!doc) return { success: false, error: 'Document introuvable' }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return { success: false, error: 'Erreur lors de la suppression' }

  await logAudit({ action: 'delete', entity_type: 'document', entity_id: id })
  revalidatePath('/dashboard/poei')
  return { success: true }
}
