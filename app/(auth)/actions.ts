'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loginSchema, registerSchema } from '@/lib/validations/auth'
import type { ActionResult } from '@/lib/types'

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { success: false, error: 'Email ou mot de passe incorrect' }
  }

  // Update last_login_at
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  redirect('/dashboard')
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    organization_name: formData.get('organization_name') as string,
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        organization_name: parsed.data.organization_name,
      },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { success: false, error: 'Un compte existe déjà avec cet email' }
    }
    return { success: false, error: 'Erreur lors de la création du compte' }
  }

  redirect('/dashboard')
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Demande de réinitialisation du mot de passe — envoie un email brandé Lab Learning
 * (au lieu de l'email Supabase par défaut). Toujours renvoie success même si l'email
 * n'existe pas, pour ne pas révéler quels comptes existent (best practice sécurité).
 */
export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Email invalide' }
  }

  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceRoleClient()

  // Récupérer le user + son organisation (multi-OF)
  const { data: user } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, organization_id')
    .eq('email', email)
    .maybeSingle()

  if (user) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
      // Génère un lien de récupération via l'admin API Supabase.
      // On route via /auth/confirm (verifyOtp côté serveur → pose la session) au lieu
      // du action_link brut : évite l'échec PKCE sur la page /reset-password.
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${appUrl}/reset-password` },
      })
      const hashedToken = (linkData as any)?.properties?.hashed_token
      const recoveryUrl = hashedToken
        ? `${appUrl}/auth/confirm?token_hash=${hashedToken}&type=recovery&next=/reset-password`
        : ((linkData as any)?.properties?.action_link || `${appUrl}/reset-password`)

      // Email brandé
      const { data: org } = await supabase.from('organizations').select('*').eq('id', user.organization_id).single()
      const { sendDocumentEmail } = await import('@/lib/email')
      await sendDocumentEmail({
        to: email,
        orgName: org?.name || 'Lab Learning',
        orgEmail: (org as any)?.email_contact || org?.email,
        orgLogoUrl: (org as any)?.logo_url,
        qualiopiCertified: (org as any)?.is_qualiopi !== false,
        recipientName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Madame, Monsieur',
        subject: 'Réinitialisation de votre mot de passe',
        docTitle: 'Réinitialisation du mot de passe',
        intro: `Vous avez demandé à réinitialiser votre mot de passe sur ${org?.name || 'Lab Learning'}. Cliquez sur le bouton ci-dessous pour en définir un nouveau.`,
        ctaLabel: 'Réinitialiser mon mot de passe',
        ctaUrl: recoveryUrl,
        footerNote: 'Ce lien est valable 1 heure. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email — votre mot de passe restera inchangé.',
      })
    } catch (e) { console.error('[reset password]', e) }
  }

  // Toujours success même si user inconnu (anti-enumeration)
  return { success: true }
}
