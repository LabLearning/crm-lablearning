'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

/**
 * Envoie à un financeur (AKTO, France Travail, OPCO EP, Opcommerce…) le
 * questionnaire d'appréciation annuel — le formulaire public /appreciation.
 * Aperçu avant envoi, trace dans email_logs (règle d'or).
 */
export async function envoyerQuestionnaireFinanceurAction(
  financeur: string,
  email: string,
  opts?: { preview?: boolean },
): Promise<ActionResult<{ html?: string; subject?: string }>> {
  const session = await getSession()
  if (['formateur', 'apprenant'].includes(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!email || !/.+@.+\..+/.test(email)) return { success: false, error: 'Email invalide' }
  const supabase = await createServiceRoleClient()

  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const url = `${APP()}/appreciation/${session.organization.id}`
  const annee = new Date().getFullYear()

  const emailParams = {
    orgName: (org as any)?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || (org as any)?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    recipientName: 'Madame, Monsieur',
    subject: `Votre appréciation ${annee} — ${(org as any)?.name || 'Lab Learning'} (organisme de formation)`,
    docTitle: `Questionnaire d'appréciation — ${financeur}`,
    intro: `Dans le cadre de notre démarche qualité Qualiopi, ${(org as any)?.name || 'Lab Learning'} recueille chaque année l'appréciation de ses financeurs. En tant que financeur de certaines de nos actions, votre regard sur la qualité de nos dossiers et notre réactivité nous est précieux — quatre questions, deux minutes.`,
    ctaLabel: 'Donner notre appréciation',
    ctaUrl: url,
    footerNote: 'Questionnaire anonyme possible — les coordonnées sont facultatives.',
  }

  if (opts?.preview) {
    const { buildDocumentEmailHtml } = await import('@/lib/email')
    return { success: true, data: { html: buildDocumentEmailHtml(emailParams), subject: emailParams.subject } }
  }

  const { sendDocumentEmail } = await import('@/lib/email')
  const r = await sendDocumentEmail({
    ...emailParams,
    to: email,
    organizationId: session.organization.id,
    entityType: 'financeur',
    entityId: session.organization.id,
    triggeredBy: session.user.id,
  })
  if (!r.success) return { success: false, error: r.error || "L'envoi a échoué" }

  await logAudit({ action: 'send_questionnaire_financeur', entity_type: 'organization', entity_id: session.organization.id, details: { financeur, email } })
  return { success: true }
}
