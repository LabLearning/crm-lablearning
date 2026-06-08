'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { inviteUserSchema, updateUserSchema } from '@/lib/validations/auth'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email'
import type { ActionResult } from '@/lib/types'

export async function inviteUserAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()

  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }

  const raw = {
    email: formData.get('email') as string,
    role: formData.get('role') as string,
  }

  const parsed = inviteUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  // Pour un compte franchise, une franchise (apporteur partenaire) doit être sélectionnée
  const franchiseId = (formData.get('franchise_id') as string) || ''
  if (parsed.data.role === 'franchise' && !franchiseId) {
    return { success: false, errors: { franchise_id: ['Sélectionnez la franchise à rattacher'] } }
  }

  const supabase = await createServiceRoleClient()

  // Check if user already exists in organization
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', session.organization.id)
    .eq('email', parsed.data.email)
    .single()

  if (existingUser) {
    return { success: false, error: 'Cet utilisateur fait déjà partie de l\'organisme' }
  }

  // Check existing invitation
  const { data: existingInvite } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', session.organization.id)
    .eq('email', parsed.data.email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (existingInvite) {
    return { success: false, error: 'Une invitation est déjà en cours pour cet email' }
  }

  // Create invitation
  const { data: invitation, error: inviteError } = await supabase
    .from('invitations')
    .insert({
      organization_id: session.organization.id,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: session.user.id,
    })
    .select()
    .single()

  if (inviteError) {
    return { success: false, error: 'Erreur lors de la création de l\'invitation' }
  }

  // Créer le user dans Supabase Auth avec createUser (crée une vraie identité email)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: false,
    user_metadata: { invitation_token: invitation.token },
  })

  if (authError) {
    // Si le user auth existe déjà, le récupérer
    if (!authError.message.includes('already')) {
      console.error('[Create Auth User Error]', authError)
    }
  }

  // Récupérer l'id du user auth
  let authUserId = authData?.user?.id || ''
  if (!authUserId) {
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers()
    const found = (allUsers || []).find((u: any) => u.email === parsed.data.email)
    authUserId = found?.id || ''
  }

  // Créer le user dans la table users (status: invited)
  if (authUserId) {
    await supabase.from('users').upsert({
      id: authUserId,
      organization_id: session.organization.id,
      email: parsed.data.email,
      first_name: '',
      last_name: '',
      role: parsed.data.role,
      franchise_id: parsed.data.role === 'franchise' ? franchiseId : null,
      status: 'invited',
    }, { onConflict: 'id' })

    // Auto-créer la fiche métier liée au user
    if (parsed.data.role === 'apporteur_affaires') {
      // Vérifier si une fiche existe déjà
      const { data: existing } = await supabase.from('apporteurs_affaires').select('id').eq('user_id', authUserId).single()
      if (!existing) {
        await supabase.from('apporteurs_affaires').insert({
          organization_id: session.organization.id,
          user_id: authUserId,
          nom: '',
          email: parsed.data.email,
          taux_commission: 10,
          is_active: true,
        })
      }
    } else if (parsed.data.role === 'formateur') {
      const { data: existing } = await supabase.from('formateurs').select('id').eq('user_id', authUserId).single()
      if (!existing) {
        await supabase.from('formateurs').insert({
          organization_id: session.organization.id,
          user_id: authUserId,
          nom: '',
          prenom: '',
          email: parsed.data.email,
          is_active: true,
        })
      }
    } else if (parsed.data.role === 'apprenant') {
      const { data: existing } = await supabase.from('apprenants').select('id').eq('user_id', authUserId).single()
      if (!existing) {
        await supabase.from('apprenants').insert({
          organization_id: session.organization.id,
          user_id: authUserId,
          nom: '',
          prenom: '',
          email: parsed.data.email,
        })
      }
    }
  }

  const inviteUrl = `${appUrl}/setup-account?token=${invitation.token}&uid=${authUserId}`
  const inviterName = `${session.user.first_name} ${session.user.last_name}`.trim() || session.user.email

  await sendInvitationEmail({
    toEmail: parsed.data.email,
    role: parsed.data.role,
    orgName: session.organization.name,
    orgEmail: (session.organization as any).email_contact || (session.organization as any).email || '',
    orgLogoUrl: (session.organization as any).logo_url || null,
    qualiopiCertified: (session.organization as any).is_qualiopi !== false,
    invitedByName: inviterName,
    inviteUrl,
  })

  await logAudit({
    action: 'invite',
    entity_type: 'user',
    entity_id: invitation.id,
    details: { email: parsed.data.email, role: parsed.data.role },
  })

  revalidatePath('/dashboard/users')
  return { success: true, data: { email: parsed.data.email } }
}

export async function updateUserRoleAction(userId: string, role: string): Promise<ActionResult> {
  const session = await getSession()

  if (session.user.role !== 'super_admin') {
    return { success: false, error: 'Seul le Super Admin peut modifier les rôles' }
  }

  if (userId === session.user.id) {
    return { success: false, error: 'Vous ne pouvez pas modifier votre propre rôle' }
  }

  const parsed = updateUserSchema.safeParse({ role })
  if (!parsed.success) {
    return { success: false, error: 'Rôle invalide' }
  }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('users')
    .update({ role: parsed.data.role })
    .eq('id', userId)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de la mise à jour du rôle' }
  }

  await logAudit({
    action: 'update_role',
    entity_type: 'user',
    entity_id: userId,
    details: { new_role: role },
  })

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function toggleUserStatusAction(userId: string, newStatus: 'active' | 'suspended'): Promise<ActionResult> {
  const session = await getSession()

  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }

  if (userId === session.user.id) {
    return { success: false, error: 'Vous ne pouvez pas modifier votre propre statut' }
  }

  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('users')
    .update({ status: newStatus })
    .eq('id', userId)
    .eq('organization_id', session.organization.id)

  if (error) {
    return { success: false, error: 'Erreur lors de la mise à jour' }
  }

  await logAudit({
    action: newStatus === 'suspended' ? 'suspend_user' : 'activate_user',
    entity_type: 'user',
    entity_id: userId,
  })

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function startImpersonationAction(targetUserId: string): Promise<ActionResult> {
  const session = await getSession()

  if (session.user.role !== 'super_admin') {
    return { success: false, error: 'Accès non autorisé' }
  }

  const supabase = await createServiceRoleClient()

  const { data: targetUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', targetUserId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!targetUser) {
    return { success: false, error: 'Utilisateur introuvable' }
  }

  if (targetUser.role === 'super_admin') {
    return { success: false, error: 'Impossible d\'accéder au compte d\'un Super Admin' }
  }

  const cookieStore = cookies()
  ;(cookieStore as any).set('ll_impersonate', targetUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  await logAudit({
    action: 'start_impersonation',
    entity_type: 'user',
    entity_id: targetUserId,
    details: { impersonated_by: session.user.id },
  })

  return { success: true }
}

export async function stopImpersonationAction(): Promise<ActionResult> {
  const cookieStore = cookies()
  ;(cookieStore as any).delete('ll_impersonate')
  return { success: true }
}

/**
 * Envoie un email d'invitation de test à l'admin connecté pour prévisualiser
 * le rendu avec sa propre boîte mail. Le lien dans le mail pointe vers le
 * dashboard (pas un vrai setup-account, c'est juste pour voir le visuel).
 */
export async function sendTestInvitationAction(role: string): Promise<ActionResult> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Acces non autorise' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const inviteUrl = `${appUrl}/dashboard` // lien de preview — pas une vraie invitation
  const inviterName = `${session.user.first_name} ${session.user.last_name}`.trim() || session.user.email

  const result = await sendInvitationEmail({
    toEmail: session.user.email,
    role,
    orgName: session.organization.name,
    orgEmail: (session.organization as any).email_contact || (session.organization as any).email || '',
    orgLogoUrl: (session.organization as any).logo_url || null,
    qualiopiCertified: (session.organization as any).is_qualiopi !== false,
    invitedByName: `${inviterName} (test)`,
    inviteUrl,
  })

  if (!result.success) return { success: false, error: result.error || 'Erreur d\'envoi' }
  return { success: true, data: { email: session.user.email } }
}

export async function resendInvitationAction(invitationId: string): Promise<ActionResult> {
  const session = await getSession()

  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Acces non autorise' }
  }

  const supabase = await createServiceRoleClient()

  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!invitation) {
    return { success: false, error: 'Invitation introuvable' }
  }

  // Extend expiry
  await supabase
    .from('invitations')
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', invitationId)

  // Regenerate invite link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'

  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: invitation.email,
    options: {
      data: { invitation_token: invitation.token },
      redirectTo: `${appUrl}/dashboard`,
    },
  })

  // Find the auth user id
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
  const authUser = (authUsers || []).find((u: any) => u.email === invitation.email)
  const inviteUrl = `${appUrl}/setup-account?token=${invitation.token}&uid=${authUser?.id || ''}`

  const inviterName = `${session.user.first_name} ${session.user.last_name}`.trim() || session.user.email

  await sendInvitationEmail({
    toEmail: invitation.email,
    role: invitation.role,
    orgName: session.organization.name,
    orgEmail: (session.organization as any).email_contact || (session.organization as any).email || '',
    orgLogoUrl: (session.organization as any).logo_url || null,
    qualiopiCertified: (session.organization as any).is_qualiopi !== false,
    invitedByName: inviterName,
    inviteUrl,
  })

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function cancelInvitationAction(invitationId: string): Promise<ActionResult> {
  const session = await getSession()

  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Acces non autorise' }
  }

  const supabase = await createServiceRoleClient()

  // Get invitation to find the email
  const { data: invitation } = await supabase
    .from('invitations')
    .select('email')
    .eq('id', invitationId)
    .eq('organization_id', session.organization.id)
    .single()

  if (!invitation) {
    return { success: false, error: 'Invitation introuvable' }
  }

  // Delete the auth user created by generateLink (if not yet accepted)
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
  const authUser = (authUsers || []).find(u => u.email === invitation.email)
  if (authUser) {
    // Only delete if user has never confirmed / signed in
    const hasConfirmed = authUser.email_confirmed_at != null
    if (!hasConfirmed) {
      await supabase.auth.admin.deleteUser(authUser.id)
    }
  }

  // Delete from users table (invited status)
  await supabase
    .from('users')
    .delete()
    .eq('email', invitation.email)
    .eq('organization_id', session.organization.id)
    .eq('status', 'invited')

  // Delete the invitation
  await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)

  revalidatePath('/dashboard/users')
  return { success: true }
}
