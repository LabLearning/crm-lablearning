'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { sendPortalAccessEmail } from '@/lib/email'
import type { ActionResult } from '@/lib/types'

type PortalType = 'apprenant' | 'formateur' | 'client' | 'apporteur'

async function fetchPersonInfo(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  type: PortalType,
  targetId: string,
  email: string,
  orgId: string
): Promise<{ firstName: string; email: string; isPartenaire: boolean }> {
  if (type === 'apprenant') {
    const { data } = await supabase.from('apprenants').select('prenom, email').eq('id', targetId).single()
    return { firstName: data?.prenom || 'Apprenant', email: data?.email || email, isPartenaire: false }
  }
  if (type === 'formateur') {
    const { data } = await supabase.from('formateurs').select('prenom, email').eq('id', targetId).single()
    return { firstName: data?.prenom || 'Formateur', email: data?.email || email, isPartenaire: false }
  }
  if (type === 'client') {
    const { data: contact } = await supabase.from('contacts').select('prenom, email').eq('email', email).eq('organization_id', orgId).single()
    return { firstName: contact?.prenom || 'Client', email: contact?.email || email, isPartenaire: false }
  }
  if (type === 'apporteur') {
    const { data } = await supabase.from('apporteurs_affaires').select('prenom, nom, email, categorie').eq('email', email).eq('organization_id', orgId).single()
    return {
      firstName: data?.prenom || data?.nom || 'Apporteur',
      email: data?.email || email,
      isPartenaire: data?.categorie === 'partenaire',
    }
  }
  return { firstName: '', email, isPartenaire: false }
}

export async function generatePortalTokenAction(
  type: PortalType,
  targetId: string,
  email: string,
  sendEmail = true
): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Check if token already exists
  const field = type === 'apprenant' ? 'apprenant_id' : type === 'formateur' ? 'formateur_id' : 'email'
  const query = supabase
    .from('portal_access_tokens')
    .select('id, token')
    .eq('organization_id', session.organization.id)
    .eq('type', type)
    .eq('is_active', true)

  if (type === 'client' || type === 'apporteur') {
    query.eq('email', email)
  } else {
    query.eq(field, targetId)
  }

  const { data: existing } = await query.single()

  if (existing) {
    return { success: true, data: { token: existing.token, existing: true } }
  }

  const insertData: Record<string, unknown> = {
    organization_id: session.organization.id,
    type,
    email,
    created_by: session.user.id,
  }
  if (type === 'apprenant') insertData.apprenant_id = targetId
  else if (type === 'formateur') insertData.formateur_id = targetId

  const { data, error } = await supabase
    .from('portal_access_tokens')
    .insert(insertData)
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la generation du token' }

  await logAudit({
    action: 'generate_portal_token',
    entity_type: type,
    entity_id: targetId || email,
  })

  // Send portal access email
  if (sendEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const portalUrl = `${appUrl}/portail/${data.token}`
    const person = await fetchPersonInfo(supabase, type, targetId, email, session.organization.id)
    const portalType = person.isPartenaire ? 'partenaire' : type

    await sendPortalAccessEmail({
      toEmail: person.email,
      firstName: person.firstName,
      portalType: portalType as any,
      portalUrl,
      orgName: session.organization.name,
      orgEmail: (session.organization as any).email_contact || session.organization.email || 'digital@lab-learning.fr',
      orgLogoUrl: (session.organization as any).logo_url || null,
      qualiopiCertified: (session.organization as any).is_qualiopi !== false,
    })
  }

  revalidatePath('/dashboard/portals')
  return { success: true, data: { token: data.token, existing: false } }
}

export async function resendPortalEmailAction(tokenId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data: tokenData } = await supabase
    .from('portal_access_tokens')
    .select('*, apprenant:apprenants(prenom, email), formateur:formateurs(prenom, email)')
    .eq('id', tokenId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!tokenData) return { success: false, error: 'Token introuvable' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalUrl = `${appUrl}/portail/${tokenData.token}`

  const person = await fetchPersonInfo(
    supabase,
    tokenData.type,
    tokenData.apprenant_id || tokenData.formateur_id || '',
    tokenData.email,
    session.organization.id
  )

  const portalType = person.isPartenaire ? 'partenaire' : tokenData.type

  const result = await sendPortalAccessEmail({
    toEmail: person.email,
    firstName: person.firstName,
    portalType: portalType as any,
    portalUrl,
    orgName: session.organization.name,
    orgEmail: session.organization.email || 'digital@lab-learning.fr',
  })

  if (!result.success) return { success: false, error: result.error }
  return { success: true }
}

export async function revokePortalTokenAction(tokenId: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('portal_access_tokens')
    .update({ is_active: false })
    .eq('id', tokenId)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  revalidatePath('/dashboard/portals')
  revalidatePath('/dashboard/apprenants')
  revalidatePath('/dashboard/formateurs')
  return { success: true }
}

export async function getPortalTokensAction(type: PortalType) {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { data } = await supabase
    .from('portal_access_tokens')
    .select('*, apprenant:apprenants(prenom, nom, email), formateur:formateurs(prenom, nom, email)')
    .eq('organization_id', session.organization.id)
    .eq('type', type)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return data || []
}
