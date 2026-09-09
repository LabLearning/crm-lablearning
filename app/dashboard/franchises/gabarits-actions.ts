'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { BUCKET_PACK_HYGIENE } from '@/lib/pdf/pack-hygiene'

type Result = { success: boolean; error?: string }
export type GabaritType = 'pms' | 'affichages' | 'livret'

const COLONNE: Record<GabaritType, string> = { pms: 'pms_path', affichages: 'affichages_path', livret: 'livret_path' }

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'franchise'

/**
 * Dépose un gabarit du Pack Hygiène pour une franchise (PDF) dans le bucket
 * privé « documents », sous pack-hygiene/<org>/franchises/<slug>/<type>.pdf,
 * et l'enregistre sur la fiche franchise. Remplace l'ancien s'il existe.
 */
export async function uploadGabaritFranchiseAction(franchiseId: string, type: GabaritType, formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Non autorisé' }
  const fichier = formData.get('fichier') as File | null
  if (!fichier || fichier.size === 0) return { success: false, error: 'Aucun fichier' }
  if (fichier.type !== 'application/pdf' && !fichier.name.toLowerCase().endsWith('.pdf')) return { success: false, error: 'Le gabarit doit être un PDF' }
  if (fichier.size > 40 * 1024 * 1024) return { success: false, error: 'Fichier trop lourd (40 Mo maximum)' }

  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const { data: fr } = await supabase.from('franchises').select('id, nom').eq('id', franchiseId).eq('organization_id', orgId).maybeSingle()
  if (!fr) return { success: false, error: 'Franchise introuvable' }

  const chemin = `pack-hygiene/${orgId}/franchises/${slug(fr.nom)}/${type}.pdf`
  const bytes = new Uint8Array(await fichier.arrayBuffer())
  const { error: eUp } = await supabase.storage.from(BUCKET_PACK_HYGIENE).upload(chemin, bytes, { contentType: 'application/pdf', upsert: true })
  if (eUp) return { success: false, error: `Dépôt impossible : ${eUp.message}` }

  const patch: Record<string, any> = { [COLONNE[type]]: chemin }
  const { error } = await supabase.from('franchises').update(patch).eq('id', franchiseId)
  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'upload_gabarit_pack_hygiene', entity_type: 'franchise', entity_id: franchiseId, details: { type, chemin, taille: fichier.size } })
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  return { success: true }
}

/** Retire un gabarit : la franchise retombe sur celui de l'organisme. */
export async function retirerGabaritFranchiseAction(franchiseId: string, type: GabaritType): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Non autorisé' }
  const supabase = await createServiceRoleClient()
  const { data: fr } = await supabase.from('franchises').select('id, pms_path, affichages_path, livret_path').eq('id', franchiseId).eq('organization_id', session.organization.id).maybeSingle()
  if (!fr) return { success: false, error: 'Franchise introuvable' }
  const chemin = (fr as any)[COLONNE[type]] as string | null
  if (chemin) await supabase.storage.from(BUCKET_PACK_HYGIENE).remove([chemin])
  const { error } = await supabase.from('franchises').update({ [COLONNE[type]]: null }).eq('id', franchiseId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  return { success: true }
}

/**
 * PMS personnalisable (gabarit Lab Learning co-brandé : le CRM remplit les
 * pages établissement et plan de formation) ou PMS propre à la franchise
 * (joint tel quel).
 */
export async function setPmsPersonnalisableAction(franchiseId: string, personnalisable: boolean): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Non autorisé' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('franchises').update({ pms_personnalisable: personnalisable })
    .eq('id', franchiseId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  return { success: true }
}

/** Lien de lecture temporaire d'un gabarit (bucket privé). */
export async function lienGabaritAction(franchiseId: string, type: GabaritType): Promise<Result & { url?: string }> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const { data: fr } = await supabase.from('franchises').select('pms_path, affichages_path, livret_path').eq('id', franchiseId).eq('organization_id', session.organization.id).maybeSingle()
  const chemin = (fr as any)?.[COLONNE[type]] as string | null
  if (!chemin) return { success: false, error: 'Aucun gabarit' }
  const { data, error } = await supabase.storage.from(BUCKET_PACK_HYGIENE).createSignedUrl(chemin, 600)
  if (error || !data?.signedUrl) return { success: false, error: 'Lien indisponible' }
  return { success: true, url: data.signedUrl }
}
