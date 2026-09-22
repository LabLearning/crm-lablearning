'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createApporteurSchema } from '@/lib/validations/crm'
import { logAudit } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function createApporteurAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createApporteurSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('apporteurs_affaires')
    .insert({
      organization_id: session.organization.id,
      type: parsed.data.type,
      raison_sociale: parsed.data.raison_sociale || null,
      siret: parsed.data.siret || null,
      nom: parsed.data.nom,
      prenom: parsed.data.prenom || null,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      taux_commission: parsed.data.taux_commission,
      commission_fixe: parsed.data.commission_fixe || null,
      mode_calcul: parsed.data.mode_calcul,
      conditions: parsed.data.conditions || null,
      date_debut_contrat: parsed.data.date_debut_contrat || null,
      date_fin_contrat: parsed.data.date_fin_contrat || null,
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Erreur lors de la création' }

  await logAudit({ action: 'create', entity_type: 'apporteur', entity_id: data.id })

  // Invitation de l'apporteur à créer son compte (email brandé), la fiche
  // qu'on vient de créer est liée au compte — jamais de fiche en double.
  let warning: string | undefined
  if (parsed.data.email) {
    const r = await inviterCompteApporteur(supabase, session, parsed.data.email, data.id)
    if (!r.success) warning = r.error
  } else {
    warning = "Sans email, l'apporteur ne recevra pas d'invitation à créer son compte."
  }

  revalidatePath('/dashboard/apporteurs')
  return warning ? { success: true, data, warning } : { success: true, data }
}

/**
 * Crée le compte (auth + users role apporteur_affaires) et envoie l'email
 * d'invitation brandé avec le lien de création de mot de passe — en liant la
 * fiche apporteur existante au compte (user_id).
 */
async function inviterCompteApporteur(
  supabase: any,
  session: { user: any; organization: any },
  email: string,
  apporteurId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Compte déjà existant dans l'organisation : on lie la fiche, sans email
    const { data: existingUser } = await supabase.from('users')
      .select('id').eq('organization_id', session.organization.id).eq('email', email).maybeSingle()
    if (existingUser) {
      await supabase.from('apporteurs_affaires').update({ user_id: existingUser.id }).eq('id', apporteurId)
      return { success: false, error: 'Un compte existe déjà pour cet email — fiche liée, aucune invitation envoyée.' }
    }

    // Invitation (réutilise une invitation en cours si elle existe)
    let { data: invitation } = await supabase.from('invitations')
      .select('id, token').eq('organization_id', session.organization.id).eq('email', email)
      .is('accepted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (!invitation) {
      const { data: inv, error: eInv } = await supabase.from('invitations').insert({
        organization_id: session.organization.id,
        email, role: 'apporteur_affaires', invited_by: session.user.id,
      }).select('id, token').single()
      if (eInv) return { success: false, error: "Invitation impossible à créer — l'apporteur est enregistré sans compte." }
      invitation = inv
    }

    const { data: authData } = await supabase.auth.admin.createUser({
      email, email_confirm: false, user_metadata: { invitation_token: invitation.token },
    })
    let authUserId = authData?.user?.id || ''
    if (!authUserId) {
      const { data: { users: allUsers } } = await supabase.auth.admin.listUsers()
      authUserId = (allUsers || []).find((u: any) => u.email === email)?.id || ''
    }
    if (!authUserId) return { success: false, error: "Compte auth introuvable — invitation non envoyée." }

    await supabase.from('users').upsert({
      id: authUserId,
      organization_id: session.organization.id,
      email, first_name: '', last_name: '',
      role: 'apporteur_affaires', status: 'invited',
    }, { onConflict: 'id' })
    await supabase.from('apporteurs_affaires').update({ user_id: authUserId }).eq('id', apporteurId)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
    const { sendInvitationEmail } = await import('@/lib/email')
    const r = await sendInvitationEmail({
      toEmail: email,
      role: 'apporteur_affaires',
      orgName: session.organization.name,
      orgEmail: (session.organization as any).email_contact || (session.organization as any).email || '',
      orgLogoUrl: (session.organization as any).logo_url || null,
      qualiopiCertified: (session.organization as any).is_qualiopi !== false,
      invitedByName: `${session.user.first_name} ${session.user.last_name}`.trim() || session.user.email,
      inviteUrl: `${appUrl}/setup-account?token=${invitation.token}&uid=${authUserId}`,
    })
    if (!r.success) return { success: false, error: `Compte créé mais email non envoyé : ${r.error || 'erreur Resend'}` }
    return { success: true }
  } catch (e: any) {
    console.error('[invitation apporteur]', e?.message)
    return { success: false, error: "L'invitation a échoué — l'apporteur est enregistré sans compte." }
  }
}

export async function updateApporteurAction(id: string, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) { raw[key] = value }

  const parsed = createApporteurSchema.safeParse(raw)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }

  const { error } = await supabase
    .from('apporteurs_affaires')
    .update({
      type: parsed.data.type,
      raison_sociale: parsed.data.raison_sociale || null,
      siret: parsed.data.siret || null,
      nom: parsed.data.nom,
      prenom: parsed.data.prenom || null,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      adresse: parsed.data.adresse || null,
      code_postal: parsed.data.code_postal || null,
      ville: parsed.data.ville || null,
      taux_commission: parsed.data.taux_commission,
      commission_fixe: parsed.data.commission_fixe || null,
      mode_calcul: parsed.data.mode_calcul,
      conditions: parsed.data.conditions || null,
      date_debut_contrat: parsed.data.date_debut_contrat || null,
      date_fin_contrat: parsed.data.date_fin_contrat || null,
    })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur lors de la mise à jour' }

  await logAudit({ action: 'update', entity_type: 'apporteur', entity_id: id })
  revalidatePath('/dashboard/apporteurs')
  return { success: true }
}

export async function toggleApporteurAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('apporteurs_affaires')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Erreur' }

  revalidatePath('/dashboard/apporteurs')
  return { success: true }
}

export async function deleteApporteurAction(id: string): Promise<ActionResult> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('apporteurs_affaires')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)

  if (error) return { success: false, error: 'Impossible de supprimer (leads liés existants)' }

  await logAudit({ action: 'delete', entity_type: 'apporteur', entity_id: id })
  revalidatePath('/dashboard/apporteurs')
  return { success: true }
}

// ─── Commissions par session ─────────────────────────────────────────────────

function peutGererCommissions(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial', 'comptable'].includes(role)
}

function rafraichirCommissions(apporteurId: string) {
  revalidatePath(`/dashboard/apporteurs/${apporteurId}`)
  revalidatePath('/dashboard/apporteurs')
  revalidatePath('/apporteur')
  revalidatePath('/apporteur/commissions')
}

/** Aligne les commissions d'un apporteur sur les sessions terminées de ses établissements (bouton « Recalculer »). */
export async function syncCommissionsApporteurAction(apporteurId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!peutGererCommissions(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const { syncCommissionsApporteur } = await import('@/lib/commission-apporteur')
  const r = await syncCommissionsApporteur(supabase, session.organization.id, { apporteurId })
  rafraichirCommissions(apporteurId)
  return { success: true, data: { creees: r.creees, misesAJour: r.misesAJour, validees: r.validees, supprimees: r.supprimees, sansMontant: r.sansMontant } }
}

/**
 * Change l'état d'une commission : en_attente, validee (à verser), payee
 * (versée, avec référence de virement), annulee. L'apporteur est prévenu
 * quand la ligne passe à verser ou versée.
 */
export async function updateCommissionApporteurStatusAction(
  commissionId: string,
  status: 'en_attente' | 'validee' | 'payee' | 'annulee',
  reference?: string,
): Promise<ActionResult> {
  const session = await getSession()
  if (!peutGererCommissions(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  if (!['en_attente', 'validee', 'payee', 'annulee'].includes(status)) return { success: false, error: 'État inconnu' }
  const supabase = await createServiceRoleClient()

  const { data: ligne } = await supabase.from('commissions')
    .select('id, apporteur_id, session_id, status, montant_commission, libelle, date_validation, client:client_id(raison_sociale, nom_commercial)')
    .eq('id', commissionId).eq('organization_id', session.organization.id).maybeSingle()
  if (!ligne) return { success: false, error: 'Commission introuvable' }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status }
  if (status === 'validee') { patch.date_validation = ligne.date_validation || now; patch.date_paiement = null; patch.reference_paiement = null }
  if (status === 'payee') { patch.date_validation = ligne.date_validation || now; patch.date_paiement = now; patch.reference_paiement = reference?.trim() || null }
  if (status === 'en_attente' || status === 'annulee') { patch.date_validation = null; patch.date_paiement = null; patch.reference_paiement = null }

  const { error } = await supabase.from('commissions').update(patch).eq('id', commissionId)
  if (error) return { success: false, error: error.message }

  if (status === 'validee' || status === 'payee') {
    const { notifierApporteur } = await import('@/lib/apporteur-notify')
    const montant = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(ligne.montant_commission || 0))
    const etab = (ligne.client as any)?.nom_commercial || (ligne.client as any)?.raison_sociale || 'un établissement'
    const formation = (ligne.libelle || '').split(' · ')[0] || 'une formation'
    await notifierApporteur(supabase, ligne.apporteur_id, session.organization.id, {
      titre: status === 'payee' ? 'Commission versée' : 'Commission à verser',
      message: status === 'payee'
        ? `Votre commission de ${montant} (${formation}, ${etab}) a été versée.`
        : `Votre commission de ${montant} (${formation}, ${etab}) est validée et sera versée prochainement.`,
      type: status === 'payee' ? 'success' : 'info',
      lienUrl: '/apporteur/commissions',
      lienLabel: 'Voir mes commissions',
      entityType: 'commission',
      entityId: commissionId,
      email: {
        subject: status === 'payee' ? `Versement de commission : ${montant}` : `Commission validée : ${montant}`,
        docTitle: status === 'payee' ? 'Votre commission a été versée' : 'Votre commission a été validée',
        intro: status === 'payee'
          ? `Votre commission liée à la formation « ${formation} » chez ${etab} vient d'être versée.`
          : `Votre commission liée à la formation « ${formation} » chez ${etab} est validée et sera versée prochainement.`,
        metadata: [
          ['Établissement', etab],
          ['Formation', formation],
          ['Montant HT', montant],
          ...(status === 'payee' && reference?.trim() ? [['Référence du virement', reference.trim()] as [string, string]] : []),
          [status === 'payee' ? 'Date de versement' : 'Validée le', new Date().toLocaleDateString('fr-FR')],
        ],
        ctaLabel: 'Voir mes commissions',
      },
    })
  }

  await logAudit({ action: `commission_apporteur_${status}`, entity_type: 'commission', entity_id: commissionId, details: { apporteur_id: ligne.apporteur_id, session_id: ligne.session_id, montant: ligne.montant_commission, reference: reference || null } })
  rafraichirCommissions(ligne.apporteur_id)
  if (ligne.session_id) revalidatePath(`/dashboard/sessions/${ligne.session_id}`)
  return { success: true }
}

/** Versement groupé : toutes les commissions à verser de l'apporteur passent en versées. */
export async function payerCommissionsApporteurAction(apporteurId: string, reference?: string): Promise<ActionResult> {
  const session = await getSession()
  if (!peutGererCommissions(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id

  const { data: aPayer } = await supabase.from('commissions').select('id, montant_commission')
    .eq('organization_id', orgId).eq('apporteur_id', apporteurId).eq('status', 'validee')
  if (!(aPayer || []).length) return { success: false, error: 'Aucune commission à verser' }
  const total = (aPayer || []).reduce((s: number, c: any) => s + Number(c.montant_commission || 0), 0)

  const now = new Date().toISOString()
  const { error } = await supabase.from('commissions')
    .update({ status: 'payee', date_paiement: now, reference_paiement: reference?.trim() || null })
    .eq('organization_id', orgId).eq('apporteur_id', apporteurId).eq('status', 'validee')
  if (error) return { success: false, error: error.message }

  const montant = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(total)
  const { notifierApporteur } = await import('@/lib/apporteur-notify')
  await notifierApporteur(supabase, apporteurId, orgId, {
    titre: 'Commissions versées',
    message: `Un versement de ${montant} couvrant ${(aPayer || []).length} commission${(aPayer || []).length > 1 ? 's' : ''} a été effectué.`,
    type: 'success',
    lienUrl: '/apporteur/commissions',
    lienLabel: 'Voir mes commissions',
    entityType: 'apporteur',
    entityId: apporteurId,
    email: {
      subject: `Versement de commissions : ${montant}`,
      docTitle: 'Versement de commissions',
      intro: `Un versement groupé vient d'être effectué pour l'ensemble de vos commissions validées.`,
      metadata: [
        ['Montant total HT', montant],
        ['Commissions', String((aPayer || []).length)],
        ...(reference?.trim() ? [['Référence du virement', reference.trim()] as [string, string]] : []),
        ['Date', new Date().toLocaleDateString('fr-FR')],
      ],
      ctaLabel: 'Voir mes commissions',
    },
  })

  await logAudit({ action: 'commissions_apporteur_payees', entity_type: 'apporteur', entity_id: apporteurId, details: { total, lignes: (aPayer || []).length, reference: reference || null } })
  rafraichirCommissions(apporteurId)
  return { success: true, data: { total } }
}
