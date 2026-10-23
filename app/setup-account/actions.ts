'use server'

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

/** Adresse comparée sans casse ni espaces : l'identité de connexion la garde en minuscules */
function adresseNormalisee(email: unknown): string {
  return String(email || '').trim().toLowerCase()
}

const LIEN_SANS_COMPTE = 'Ce lien d\'invitation ne correspond à aucun compte en attente. Demandez une nouvelle invitation à votre administrateur.'

export async function setupAccountAction(formData: FormData): Promise<ActionResult> {
  const firstName = (formData.get('firstName') as string)?.trim()
  const lastName = (formData.get('lastName') as string)?.trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const token = formData.get('token') as string
  const uid = formData.get('uid') as string

  if (!firstName || !lastName) {
    return { success: false, error: 'Veuillez renseigner votre prénom et nom' }
  }

  if (!password || password.length < 8) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' }
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Les mots de passe ne correspondent pas' }
  }

  if (!token || !uid) {
    return { success: false, error: 'Lien d\'invitation invalide' }
  }

  const supabase = await createServiceRoleClient()

  // Vérifier le token d'invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (!invitation) {
    return { success: false, error: 'Invitation invalide ou déjà utilisée' }
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { success: false, error: 'Cette invitation a expiré. Demandez un nouveau lien.' }
  }

  // Le compte activé est celui de l'invitation (son adresse, son organisme),
  // jamais celui que désigne le formulaire : l'uid du lien n'est qu'un
  // recoupement. Sans cela, le détenteur de n'importe quelle invitation
  // valide posait le mot de passe d'un autre compte, super admin compris.
  // ilike : la casse peut différer ; le filtre exact ci-dessous écarte ce
  // que les caractères joker (_ %) laisseraient passer
  const emailInvite = adresseNormalisee(invitation.email)
  const { data: candidats } = await supabase
    .from('users')
    .select('id, email, status')
    .eq('organization_id', invitation.organization_id)
    .ilike('email', emailInvite)
  const comptes = (candidats || []).filter((c: any) => adresseNormalisee(c.email) === emailInvite)
  const compte: any = comptes.length === 1 ? comptes[0] : null
  if (!compte || compte.id !== uid) {
    return { success: false, error: LIEN_SANS_COMPTE }
  }
  // Un compte déjà actif ne se réinitialise pas par une invitation restée en
  // attente : « Mot de passe oublié » est fait pour ça
  if (compte.status === 'active') {
    return { success: false, error: 'Ce compte est déjà activé. Connectez-vous avec votre mot de passe, ou utilisez « Mot de passe oublié ».' }
  }
  // Hors invitation en cours, seul un accès franchise révoqué puis réinvité se
  // réactive ici : la réinvitation (inviteFranchiseUserAction) le laisse en
  // « suspended », son upsert sans prénom ni nom étant refusé par la base
  if (compte.status !== 'invited' && invitation.role !== 'franchise') {
    return { success: false, error: 'Ce compte est suspendu ou désactivé. Contactez votre administrateur.' }
  }
  // L'identité de connexion doit porter l'adresse de l'invitation
  const { data: identite } = await supabase.auth.admin.getUserById(compte.id)
  if (!identite?.user || adresseNormalisee(identite.user.email) !== emailInvite) {
    return { success: false, error: LIEN_SANS_COMPTE }
  }
  const compteId: string = compte.id

  // Mettre à jour le mot de passe + confirmer l'email
  const { error: authError } = await supabase.auth.admin.updateUserById(compteId, {
    password,
    email_confirm: true,
  })

  if (authError) {
    return { success: false, error: 'Erreur lors de l\'activation : ' + authError.message }
  }

  // Mettre à jour le profil dans la table users
  await supabase
    .from('users')
    .update({
      first_name: firstName,
      last_name: lastName,
      status: 'active',
    })
    .eq('id', compteId)
    .eq('organization_id', invitation.organization_id)

  // Mettre à jour la fiche métier avec le nom/prénom
  if (invitation.role === 'formateur') {
    await supabase.from('formateurs').update({ nom: lastName, prenom: firstName }).eq('user_id', compteId)
  } else if (invitation.role === 'apporteur_affaires') {
    await supabase.from('apporteurs_affaires').update({ nom: lastName, prenom: firstName }).eq('user_id', compteId)
  } else if (invitation.role === 'apprenant') {
    await supabase.from('apprenants').update({ nom: lastName, prenom: firstName }).eq('user_id', compteId)
  }

  // Marquer l'invitation comme acceptée
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  // Connexion automatique (pose les cookies de session)
  const anonClient = await createServerSupabaseClient()
  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: invitation.email,
    password,
  })

  if (signInError) {
    // Si la connexion auto échoue, ce n'est pas grave — l'utilisateur peut se connecter manuellement
    console.error('[Setup] Auto sign-in failed:', signInError.message)
    return { success: true, data: { email: invitation.email, autoLogin: false } }
  }

  return { success: true, data: { email: invitation.email, autoLogin: true } }
}
