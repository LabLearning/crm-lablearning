'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendInvitationEmail } from '@/lib/email'
import { recalcDossierCommission, type CommissionType } from '@/lib/commission'
import { notifyFranchiseUsers } from '@/lib/franchise-notify'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string }

// ════════════════════════════════════════════════════════════
// CRUD FRANCHISES
// ════════════════════════════════════════════════════════════

export async function createFranchiseAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()

  const nom = (formData.get('nom') as string || '').trim()
  if (!nom) return { success: false, error: 'Le nom de l\'enseigne est requis' }

  const num = (k: string) => {
    const v = formData.get(k) as string
    return v ? parseFloat(v) : null
  }
  const int = (k: string) => {
    const v = formData.get(k) as string
    return v ? parseInt(v) : null
  }
  const str = (k: string) => (formData.get(k) as string || '').trim() || null

  const commissionType = (formData.get('commission_type') as string) || 'budget_debloque'
  const tauxRaw = formData.get('taux_commission') as string
  const taux = tauxRaw ? parseFloat(tauxRaw) : commissionType === 'budget_net' ? 40 : 10

  const { data, error } = await supabase
    .from('franchises')
    .insert({
      organization_id: session.organization.id,
      nom,
      raison_sociale: str('raison_sociale'),
      siret: str('siret'),
      secteur: str('secteur'),
      nombre_etablissements: int('nombre_etablissements'),
      zone_geographique: str('zone_geographique'),
      contact_nom: str('contact_nom'),
      contact_email: str('contact_email'),
      contact_telephone: str('contact_telephone'),
      objectif_annuel_ca: num('objectif_annuel_ca'),
      commission_type: commissionType,
      taux_commission: taux,
      notes: str('notes'),
      is_active: true,
      created_by: session.user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  await logAudit({ action: 'create', entity_type: 'franchise', entity_id: data.id })
  revalidatePath('/dashboard/franchises')
  return { success: true, data }
}

export async function updateFranchiseAction(id: string, formData: FormData): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const str = (k: string) => (formData.get(k) as string || '').trim() || null
  const updates: Record<string, unknown> = {}
  if (formData.has('nom')) {
    const nom = (formData.get('nom') as string || '').trim()
    if (!nom) return { success: false, error: 'Nom requis' }
    updates.nom = nom
  }
  for (const k of ['raison_sociale', 'siret', 'secteur', 'zone_geographique', 'contact_nom', 'contact_email', 'contact_telephone', 'adresse', 'code_postal', 'ville', 'notes']) {
    if (formData.has(k)) updates[k] = str(k)
  }
  if (formData.has('nombre_etablissements')) {
    const v = formData.get('nombre_etablissements') as string
    updates.nombre_etablissements = v ? parseInt(v) : null
  }
  if (formData.has('objectif_annuel_ca')) {
    const v = formData.get('objectif_annuel_ca') as string
    updates.objectif_annuel_ca = v ? parseFloat(v) : null
  }

  const { error } = await supabase
    .from('franchises')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/franchises')
  revalidatePath(`/dashboard/franchises/${id}`)
  return { success: true }
}

export async function deleteFranchiseAction(id: string): Promise<Result> {
  const session = await getSession()
  if (session.user.role !== 'super_admin') {
    return { success: false, error: 'Seul le Super Admin peut supprimer une franchise' }
  }
  const supabase = await createServiceRoleClient()

  // Empêcher la suppression si des comptes franchise y sont rattachés
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('franchise_id', id)
    .eq('role', 'franchise')
  if ((count || 0) > 0) {
    return { success: false, error: 'Des comptes utilisateurs sont rattachés. Révoquez-les d\'abord.' }
  }

  const { error } = await supabase
    .from('franchises')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/franchises')
  return { success: true }
}

/**
 * Invite un utilisateur franchise (compte avec login, rôle 'franchise').
 * Crée l'auth user + la ligne users (role=franchise, franchise_id) + invitation + email brandé.
 */
export async function inviteFranchiseUserAction(franchiseId: string, emailRaw: string): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const email = (emailRaw || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Adresse email invalide' }
  }

  const supabase = await createServiceRoleClient()

  // Vérifier que la franchise existe
  const { data: franchise } = await supabase
    .from('franchises')
    .select('id, nom, raison_sociale')
    .eq('id', franchiseId)
    .eq('organization_id', session.organization.id)
    .single()
  if (!franchise) return { success: false, error: 'Franchise introuvable' }

  // Déjà membre ?
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', session.organization.id)
    .eq('email', email)
    .maybeSingle()
  if (existingUser) return { success: false, error: 'Cet email a déjà un compte dans l\'organisme' }

  // Invitation
  const { data: invitation, error: inviteError } = await supabase
    .from('invitations')
    .insert({
      organization_id: session.organization.id,
      email,
      role: 'franchise',
      invited_by: session.user.id,
    })
    .select()
    .single()
  if (inviteError) return { success: false, error: 'Erreur lors de la création de l\'invitation' }

  // Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { invitation_token: invitation.token },
  })
  if (authError && !authError.message.includes('already')) {
    console.error('[invite franchise]', authError)
  }
  let authUserId = authData?.user?.id || ''
  if (!authUserId) {
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers()
    authUserId = (allUsers || []).find((u: any) => u.email === email)?.id || ''
  }
  if (!authUserId) return { success: false, error: 'Impossible de créer le compte utilisateur' }

  // Ligne users avec rôle franchise + rattachement franchise
  await supabase.from('users').upsert({
    id: authUserId,
    organization_id: session.organization.id,
    email,
    first_name: '',
    last_name: '',
    role: 'franchise',
    franchise_id: franchiseId,
    status: 'invited',
  }, { onConflict: 'id' })

  // Email brandé
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr'
  const inviteUrl = `${appUrl}/setup-account?token=${invitation.token}&uid=${authUserId}`
  const inviterName = `${session.user.first_name} ${session.user.last_name}`.trim() || session.user.email
  await sendInvitationEmail({
    toEmail: email,
    role: 'franchise',
    orgName: session.organization.name,
    orgEmail: (session.organization as any).email_contact || (session.organization as any).email || '',
    orgLogoUrl: (session.organization as any).logo_url || null,
    qualiopiCertified: (session.organization as any).is_qualiopi !== false,
    invitedByName: inviterName,
    inviteUrl,
  })

  await logAudit({ action: 'invite_franchise', entity_type: 'franchise', entity_id: franchiseId, details: { email } })
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  return { success: true, data: { email } }
}

/** Révoque l'accès d'un utilisateur franchise (status suspended). */
export async function revokeFranchiseUserAction(userId: string): Promise<Result> {
  const session = await getSession()
  if (!['super_admin', 'gestionnaire'].includes(session.user.role)) {
    return { success: false, error: 'Accès non autorisé' }
  }
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('users')
    .update({ status: 'suspended' })
    .eq('id', userId)
    .eq('organization_id', session.organization.id)
    .eq('role', 'franchise')
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/franchises')
  return { success: true }
}

/**
 * Met à jour la config commission d'une franchise (mode + taux),
 * puis recalcule toutes les commissions "à venir" de ses dossiers.
 */
export async function updateFranchiseCommissionConfigAction(
  franchiseId: string,
  commissionType: CommissionType,
  taux: number,
): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('franchises')
    .update({ commission_type: commissionType, taux_commission: taux })
    .eq('id', franchiseId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  // Recalcul des dossiers non figés de cette franchise
  const { data: dossiers } = await supabase
    .from('dossiers_formation')
    .select('id, client_id')
    .eq('organization_id', session.organization.id)
    .or(`franchise_id.eq.${franchiseId},client_id.in.(${await clientIdsOfFranchise(supabase, franchiseId)})`)

  for (const d of dossiers || []) {
    await recalcDossierCommission(supabase, d.id, session.organization.id)
  }

  await logAudit({ action: 'update_commission_config', entity_type: 'franchise', entity_id: franchiseId })
  revalidatePath('/dashboard/franchises')
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  return { success: true }
}

async function clientIdsOfFranchise(supabase: any, franchiseId: string): Promise<string> {
  const { data } = await supabase.from('clients').select('id').eq('franchise_id', franchiseId)
  const ids = (data || []).map((c: any) => c.id)
  return ids.length > 0 ? ids.join(',') : '00000000-0000-0000-0000-000000000000'
}

/** Recalcule la commission d'un dossier précis (bouton manuel). */
export async function recalcCommissionAction(dossierId: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()
  const r = await recalcDossierCommission(supabase, dossierId, session.organization.id)
  revalidatePath('/dashboard/franchises')
  return { success: true, data: r }
}

/** Change le statut d'une commission de dossier (valider / payer / annuler / remettre à venir). */
export async function updateCommissionStatusAction(
  dossierId: string,
  status: 'a_venir' | 'validee' | 'payee' | 'annulee',
): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const updates: Record<string, unknown> = { commission_status: status }
  if (status === 'payee') updates.commission_payee_at = new Date().toISOString()
  if (status === 'a_venir') updates.commission_payee_at = null

  const { error } = await supabase
    .from('dossiers_formation')
    .update(updates)
    .eq('id', dossierId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  // Notifier la franchise quand sa commission est validée ou payée
  if (status === 'validee' || status === 'payee') {
    const { data: d } = await supabase
      .from('dossiers_formation')
      .select('franchise_id, commission_montant, client:clients(raison_sociale)')
      .eq('id', dossierId)
      .single()
    if (d?.franchise_id) {
      const montant = fmtEuro(Number(d.commission_montant || 0))
      const etab = (d.client as any)?.raison_sociale || 'un établissement'
      await notifyFranchiseUsers(supabase, d.franchise_id, session.organization.id, {
        titre: status === 'payee' ? 'Commission versée' : 'Commission validée',
        message: status === 'payee'
          ? `Votre commission de ${montant} (${etab}) a été versée.`
          : `Votre commission de ${montant} (${etab}) a été validée et sera bientôt versée.`,
        type: status === 'payee' ? 'success' : 'info',
        lienUrl: '/franchise/financier',
        lienLabel: 'Voir mes commissions',
        entityType: 'dossier_formation',
        entityId: dossierId,
        email: {
          subject: status === 'payee' ? `Versement de commission — ${montant}` : `Commission validée — ${montant}`,
          docTitle: status === 'payee' ? 'Votre commission a été versée' : 'Votre commission a été validée',
          intro: status === 'payee'
            ? `Bonne nouvelle : votre commission liée à la formation chez ${etab} vient d'être versée.`
            : `Votre commission liée à la formation chez ${etab} est validée et sera versée prochainement.`,
          metadata: [
            ['Établissement', etab],
            ['Montant', montant],
            [status === 'payee' ? 'Date de versement' : 'Validée le', new Date().toLocaleDateString('fr-FR')],
          ],
          ctaLabel: 'Voir mes commissions',
        },
      })
    }
  }

  await logAudit({ action: `commission_${status}`, entity_type: 'dossier_formation', entity_id: dossierId })
  revalidatePath('/dashboard/franchises')
  revalidatePath(`/dashboard/dossiers/${dossierId}`)
  return { success: true }
}

/** Rattache (ou détache) un établissement (client) à une franchise. */
export async function linkClientToFranchiseAction(
  clientId: string,
  franchiseId: string | null,
): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  const { error } = await supabase
    .from('clients')
    .update({ franchise_id: franchiseId })
    .eq('id', clientId)
    .eq('organization_id', session.organization.id)
  if (error) return { success: false, error: error.message }

  // Recalcul des dossiers de ce client
  const { data: dossiers } = await supabase
    .from('dossiers_formation')
    .select('id')
    .eq('client_id', clientId)
    .eq('organization_id', session.organization.id)
  for (const d of dossiers || []) {
    await recalcDossierCommission(supabase, d.id, session.organization.id)
  }

  revalidatePath('/dashboard/franchises')
  return { success: true }
}

/** Marque toutes les commissions validées d'une franchise comme payées (paiement groupé). */
export async function payAllValidatedAction(franchiseId: string): Promise<Result> {
  const session = await getSession()
  const supabase = await createServiceRoleClient()

  // Total avant bascule (pour la notification)
  const { data: aPayer } = await supabase
    .from('dossiers_formation')
    .select('commission_montant')
    .eq('organization_id', session.organization.id)
    .eq('franchise_id', franchiseId)
    .eq('commission_status', 'validee')
  const total = (aPayer || []).reduce((s: number, d: any) => s + Number(d.commission_montant || 0), 0)

  const { error } = await supabase
    .from('dossiers_formation')
    .update({ commission_status: 'payee', commission_payee_at: new Date().toISOString() })
    .eq('organization_id', session.organization.id)
    .eq('franchise_id', franchiseId)
    .eq('commission_status', 'validee')
  if (error) return { success: false, error: error.message }

  if (total > 0) {
    await notifyFranchiseUsers(supabase, franchiseId, session.organization.id, {
      titre: 'Commissions versées',
      message: `Un versement de ${fmtEuro(total)} de commissions a été effectué.`,
      type: 'success',
      lienUrl: '/franchise/financier',
      lienLabel: 'Voir mes commissions',
      email: {
        subject: `Versement groupé — ${fmtEuro(total)}`,
        docTitle: 'Versement de commissions',
        intro: `Un versement groupé vient d'être effectué pour l'ensemble de vos commissions validées.`,
        metadata: [
          ['Montant total', fmtEuro(total)],
          ['Date de versement', new Date().toLocaleDateString('fr-FR')],
        ],
        ctaLabel: 'Voir le détail',
      },
    })
  }

  await logAudit({ action: 'commission_pay_all', entity_type: 'franchise', entity_id: franchiseId })
  revalidatePath('/dashboard/franchises')
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  return { success: true }
}
