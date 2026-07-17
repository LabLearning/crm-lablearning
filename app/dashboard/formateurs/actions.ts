'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createFormateurSchema } from '@/lib/validations/formation'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

function splitComma(text: string | undefined): string[] {
  if (!text) return []
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}

// Provisionne l'accès à l'outil Audit Hygiène & DUERP (projet Supabase séparé).
// Renvoie le lien d'activation à inclure dans l'email, ou null si non configuré/échec.
async function provisionAuditToolAccess(email: string, prenom: string, nom: string): Promise<string | null> {
  const url = process.env.AUDIT_SUPABASE_URL
  const serviceKey = process.env.AUDIT_SUPABASE_SERVICE_ROLE_KEY
  const appUrl = process.env.AUDIT_TOOL_APP_URL
  if (!url || !serviceKey) return null
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const audit = createClient(url, serviceKey, { auth: { persistSession: false } })
    // Crée le compte (ignore s'il existe déjà)
    await audit.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { prenom, nom, source: 'crm-lablearning' },
    }).catch(() => null)
    // Lien d'activation (définition du mot de passe) vers l'outil
    const { data: linkData } = await audit.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: appUrl ? { redirectTo: appUrl } : undefined,
    })
    return (linkData as any)?.properties?.action_link || appUrl || null
  } catch (e) {
    console.error('[audit tool provisioning]', e)
    return null
  }
}

// Onboarding complet du formateur : compte CRM (invitation) + outil audit + email de bienvenue
async function onboardFormateur(
  supabase: any,
  session: any,
  formateurId: string,
  data: { email: string; prenom: string; nom: string },
  withAuditTool: boolean,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  // 1. Invitation (token de setup)
  const { data: invitation } = await supabase
    .from('invitations')
    .insert({
      organization_id: session.organization.id,
      email: data.email,
      role: 'formateur',
      invited_by: session.user.id,
    })
    .select()
    .single()
  if (!invitation) return

  // 2. Compte Supabase Auth
  const { data: authData } = await supabase.auth.admin.createUser({
    email: data.email,
    email_confirm: false,
    user_metadata: { invitation_token: invitation.token },
  }).catch(() => ({ data: null }))
  let authUserId = authData?.user?.id || ''
  if (!authUserId) {
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers()
    authUserId = ((allUsers || []).find((u: any) => u.email === data.email))?.id || ''
  }
  if (!authUserId) return

  // 3. Ligne users (status invited) + liaison de la fiche formateur existante
  await supabase.from('users').upsert({
    id: authUserId,
    organization_id: session.organization.id,
    email: data.email,
    first_name: data.prenom,
    last_name: data.nom,
    role: 'formateur',
    status: 'invited',
  }, { onConflict: 'id' })
  await supabase.from('formateurs').update({ user_id: authUserId }).eq('id', formateurId)

  // 4. Outil Audit Hygiène & DUERP (si demandé)
  const auditUrl = withAuditTool
    ? await provisionAuditToolAccess(data.email, data.prenom, data.nom)
    : null

  // 4bis. Lien portail formateur (sessions, émargement, apprenants)
  let portalUrl: string | null = null
  try {
    const { data: existingTok } = await supabase
      .from('portal_access_tokens')
      .select('token')
      .eq('organization_id', session.organization.id)
      .eq('type', 'formateur')
      .eq('formateur_id', formateurId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    let token = existingTok?.token
    if (!token) {
      const { data: created } = await supabase
        .from('portal_access_tokens')
        .insert({
          organization_id: session.organization.id,
          type: 'formateur',
          formateur_id: formateurId,
          email: data.email,
          created_by: session.user.id,
        })
        .select('token')
        .single()
      token = created?.token
    }
    if (token) portalUrl = `${appUrl}/portail/${token}`
  } catch (e) { console.error('[onboard formateur — portail]', e) }

  // 5. Email de bienvenue unique
  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.organization.id).single()
  const { sendFormateurWelcomeEmail } = await import('@/lib/email')
  await sendFormateurWelcomeEmail({
    toEmail: data.email,
    prenom: data.prenom,
    orgName: org?.name || 'Lab Learning',
    orgEmail: (org as any)?.email_contact || org?.email,
    orgLogoUrl: (org as any)?.logo_url,
    qualiopiCertified: (org as any)?.is_qualiopi !== false,
    inviteUrl: `${appUrl}/setup-account?token=${invitation.token}&uid=${authUserId}`,
    auditUrl,
    portalUrl,
  })
}

/**
 * Envoie (ou renvoie) l'accès complet à un formateur existant :
 * compte + email de bienvenue + lien portail. Pour les fiches créées
 * sans email ou importées (Dendreo) avant le système d'onboarding.
 */
export async function sendFormateurAccessAction(formateurId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const { data: formateur } = await supabase
    .from('formateurs')
    .select('id, prenom, nom, email, domaines_expertise')
    .eq('id', formateurId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!formateur) return { success: false, error: 'Formateur introuvable' }
  if (!formateur.email) return { success: false, error: "Renseignez d'abord l'email du formateur sur sa fiche" }

  try {
    await onboardFormateur(
      supabase,
      session,
      formateur.id,
      { email: formateur.email, prenom: formateur.prenom, nom: formateur.nom },
      false,
    )
  } catch (e) {
    console.error('[send formateur access]', e)
    return { success: false, error: "Échec de l'envoi de l'accès" }
  }

  await logAudit({ action: 'send_access', entity_type: 'formateur', entity_id: formateurId })
  revalidatePath('/dashboard/formateurs')
  return { success: true, data: { email: formateur.email } }
}

export async function createFormateurAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFormateurSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('formateurs')
    .insert({
      organization_id: session.organization.id,
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      whatsapp: parsed.data.whatsapp || null,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
      qualifications: parsed.data.qualifications || null,
      domaines_expertise: splitComma(parsed.data.domaines_expertise),
      certifications: splitComma(parsed.data.certifications),
      type_contrat: parsed.data.type_contrat,
      siret: parsed.data.siret || null,
      tarif_journalier: parsed.data.tarif_journalier || null,
      tarif_horaire: parsed.data.tarif_horaire || null,
      zone_intervention: parsed.data.zone_intervention || null,
      photo_url: parsed.data.photo_url || null,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  // Onboarding : compte CRM + outil audit (si coché) + email de bienvenue unique
  if (parsed.data.email) {
    try {
      await onboardFormateur(
        supabase,
        session,
        data.id,
        { email: parsed.data.email, prenom: parsed.data.prenom, nom: parsed.data.nom },
        formData.get('audit_tool_access') === 'true',
      )
    } catch (e) {
      console.error('[onboard formateur]', e) // la fiche est créée même si l'onboarding échoue
    }
  }

  await logAudit({ action: 'create', entity_type: 'formateur', entity_id: data.id })
  revalidatePath('/dashboard/formateurs')
  return { success: true, data }
}

export async function updateFormateurAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createFormateurSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formateurs')
    .update({
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      whatsapp: parsed.data.whatsapp || null,
      whatsapp_opt_in: parsed.data.whatsapp_opt_in === true,
      qualifications: parsed.data.qualifications || null,
      domaines_expertise: splitComma(parsed.data.domaines_expertise),
      certifications: splitComma(parsed.data.certifications),
      type_contrat: parsed.data.type_contrat,
      siret: parsed.data.siret || null,
      tarif_journalier: parsed.data.tarif_journalier || null,
      tarif_horaire: parsed.data.tarif_horaire || null,
      zone_intervention: parsed.data.zone_intervention || null,
      photo_url: parsed.data.photo_url || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'formateur', entity_id: id })
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function updateHabilitationAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const dateHabilitation = formData.get('date_derniere_habilitation') as string
  const prochaineMaj = formData.get('prochaine_mise_a_jour') as string
  const notes = formData.get('habilitation_notes') as string

  // Fetch current history
  const { data: current } = await supabase
    .from('formateurs')
    .select('historique_habilitations')
    .eq('id', id)
    .single()

  const history = [...(current?.historique_habilitations || []), {
    date: dateHabilitation,
    notes: notes || '',
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  }]

  const { error } = await supabase
    .from('formateurs')
    .update({
      date_derniere_habilitation: dateHabilitation || null,
      prochaine_mise_a_jour: prochaineMaj || null,
      historique_habilitations: history,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  await logAudit({ action: 'update_habilitation', entity_type: 'formateur', entity_id: id })
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function toggleFormateurAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formateurs')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function deleteFormateurAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('formateurs')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (sessions liées)' }

  await logAudit({ action: 'delete', entity_type: 'formateur', entity_id: id })
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}
