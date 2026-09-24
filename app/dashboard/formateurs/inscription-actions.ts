'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

const ROLES_LIEN = ['super_admin', 'gestionnaire', 'commercial']
const manque160 = (e: any) => e && /inscription_formateur_token|a_verifier|formateur_inscriptions|42703|42P01|PGRST204|PGRST205/i.test(`${e.code} ${e.message}`)

/** Envoie le lien général d'inscription à un formateur, par mail (tracé dans l'historique). */
export async function envoyerLienInscriptionAction(email: string, prenom?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!ROLES_LIEN.includes(session.user.role)) return { success: false, error: 'Action non autorisée' }
  const dest = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dest)) return { success: false, error: 'Adresse email invalide' }

  const supabase = await createServiceRoleClient()
  const { data: org, error } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  if (manque160(error) || !(org as any)?.inscription_formateur_token) return { success: false, error: 'Le lien n’existe pas encore : appliquez la migration 160.' }
  if (error) return { success: false, error: error.message }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const lien = `${appUrl}/devenir-formateur/${(org as any).inscription_formateur_token}`
  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    to: dest,
    orgName: (org as any).name || 'Lab Learning',
    orgEmail: (org as any).email_contact || (org as any).email,
    orgLogoUrl: (org as any).logo_url,
    qualiopiCertified: (org as any).is_qualiopi !== false,
    recipientName: String(prenom || '').trim().replace(/[<>&"]/g, '') || 'Madame, Monsieur',
    subject: `Votre fiche formateur ${(org as any).name || 'Lab Learning'}`,
    docTitle: 'Complétez votre fiche formateur',
    intro: 'Pour vous proposer des missions de formation, nous avons besoin de quelques informations : vos domaines d’intervention, votre statut, vos tarifs et votre CV. Cela prend environ cinq minutes.',
    ctaLabel: 'Remplir ma fiche',
    ctaUrl: lien,
    organizationId: session.organization.id,
    entityType: 'formateur_inscription',
    triggeredBy: session.user.id,
    templateSlug: 'formateur_inscription_lien',
  })
  if (!r.success) return { success: false, error: r.error || 'Échec de l’envoi' }
  await logAudit({ action: 'lien_inscription_formateur_envoye', entity_type: 'organization', entity_id: session.organization.id, details: { email: dest } })
  return { success: true }
}

/** Remplace le lien général : l'ancien cesse aussitôt de fonctionner. */
export async function regenererLienInscriptionAction(): Promise<ActionResult<{ token: string }>> {
  const session = await getSession()
  if (session.user.role !== 'super_admin') return { success: false, error: 'Réservé à la direction' }
  const token = crypto.randomUUID().replace(/-/g, '')
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('organizations').update({ inscription_formateur_token: token }).eq('id', session.organization.id)
  if (manque160(error)) return { success: false, error: 'Appliquez d’abord la migration 160.' }
  if (error) return { success: false, error: error.message }
  await logAudit({ action: 'lien_inscription_formateur_regenere', entity_type: 'organization', entity_id: session.organization.id, details: {} })
  revalidatePath('/dashboard/formateurs')
  return { success: true, data: { token } }
}

/** La fiche remplie par le formateur a été relue : on retire la mention « à vérifier ». */
export async function marquerFormateurVerifieAction(formateurId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) return { success: false, error: 'Action non autorisée' }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('formateurs').update({ a_verifier: false })
    .eq('id', formateurId).eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }
  await logAudit({ action: 'formateur_verifie', entity_type: 'formateur', entity_id: formateurId, details: {} })
  revalidatePath('/dashboard/formateurs')
  revalidatePath(`/dashboard/formateurs/${formateurId}`)
  return { success: true }
}
