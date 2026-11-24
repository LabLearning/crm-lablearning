'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { recalcSessionCommission, syncFranchiseCommissions } from '@/lib/commission'
import { notifyFranchiseUsers } from '@/lib/franchise-notify'

type Result = { success: boolean; error?: string; data?: any }
type CommStatus = 'a_venir' | 'validee' | 'payee' | 'annulee'

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

function peutGerer(role: string) {
  return ['super_admin', 'gestionnaire', 'directeur_commercial'].includes(role)
}

/** Aligne les commissions d'une franchise sur ses sessions (bouton « Recalculer »). */
export async function syncFranchiseCommissionsAction(franchiseId: string): Promise<Result> {
  const session = await getSession()
  if (!peutGerer(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const n = await syncFranchiseCommissions(supabase, franchiseId, session.organization.id)
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  revalidatePath('/dashboard/franchises')
  return { success: true, data: { sessions: n } }
}

/** Recalcule la commission d'une session précise. */
export async function recalcSessionCommissionAction(sessionId: string): Promise<Result> {
  const session = await getSession()
  if (!peutGerer(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()
  const r = await recalcSessionCommission(supabase, sessionId, session.organization.id)
  revalidatePath('/dashboard/franchises')
  return { success: true, data: r }
}

/** Valider / payer / annuler / remettre à venir la commission d'une session. */
export async function updateSessionCommissionStatusAction(sessionId: string, status: CommStatus): Promise<Result> {
  const session = await getSession()
  if (!peutGerer(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'validee') patch.validee_at = new Date().toISOString()
  if (status === 'payee') patch.payee_at = new Date().toISOString()
  if (status === 'a_venir') { patch.payee_at = null; patch.validee_at = null }

  const { data: ligne, error } = await supabase.from('commissions_sessions')
    .update(patch).eq('session_id', sessionId).eq('organization_id', session.organization.id)
    .select('id, franchise_id, commission_montant, client:client_id(raison_sociale)').single()
  if (error || !ligne) return { success: false, error: error?.message || 'Ligne introuvable' }

  if ((status === 'validee' || status === 'payee') && ligne.franchise_id) {
    const montant = fmtEuro(Number(ligne.commission_montant || 0))
    const etab = (ligne.client as any)?.raison_sociale || 'un établissement'
    await notifyFranchiseUsers(supabase, ligne.franchise_id, session.organization.id, {
      titre: status === 'payee' ? 'Commission versée' : 'Commission validée',
      message: status === 'payee'
        ? `Votre commission de ${montant} TTC (${etab}) a été versée.`
        : `Votre commission de ${montant} TTC (${etab}) a été validée et sera bientôt versée.`,
      type: status === 'payee' ? 'success' : 'info',
      lienUrl: '/franchise/financier',
      lienLabel: 'Voir mes commissions',
      entityType: 'session',
      entityId: sessionId,
      email: {
        subject: status === 'payee' ? `Versement de commission — ${montant} TTC` : `Commission validée — ${montant} TTC`,
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

  // Rouverte (validation ou paiement annulés) : elle reprend tout de suite les
  // coûts du moment, sans attendre la prochaine synchro de la fiche franchise
  if (status === 'a_venir') {
    try { await recalcSessionCommission(supabase, sessionId, session.organization.id) } catch (e) { console.error('[commission rouverte]', e) }
  }

  await logAudit({ action: `commission_session_${status}`, entity_type: 'session', entity_id: sessionId })
  revalidatePath('/dashboard/franchises')
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return { success: true }
}

/** Paiement groupé : toutes les commissions validées de la franchise passent en payées. */
export async function payAllValidatedSessionsAction(franchiseId: string): Promise<Result> {
  const session = await getSession()
  if (!peutGerer(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const supabase = await createServiceRoleClient()

  const { data: aPayer } = await supabase.from('commissions_sessions').select('commission_montant')
    .eq('organization_id', session.organization.id).eq('franchise_id', franchiseId).eq('status', 'validee')
  const total = (aPayer || []).reduce((s: number, c: any) => s + Number(c.commission_montant || 0), 0)
  if (!(aPayer || []).length) return { success: false, error: 'Aucune commission validée à payer' }

  const { error } = await supabase.from('commissions_sessions')
    .update({ status: 'payee', payee_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', session.organization.id).eq('franchise_id', franchiseId).eq('status', 'validee')
  if (error) return { success: false, error: error.message }

  if (total > 0) {
    await notifyFranchiseUsers(supabase, franchiseId, session.organization.id, {
      titre: 'Commissions versées',
      message: `Un versement de ${fmtEuro(total)} TTC de commissions a été effectué.`,
      type: 'success',
      lienUrl: '/franchise/financier',
      lienLabel: 'Voir mes commissions',
      email: {
        subject: `Versement groupé — ${fmtEuro(total)}`,
        docTitle: 'Versement de commissions',
        intro: `Un versement groupé vient d'être effectué pour l'ensemble de vos commissions validées.`,
        metadata: [['Montant total', fmtEuro(total)], ['Date', new Date().toLocaleDateString('fr-FR')]],
        ctaLabel: 'Voir mes commissions',
      },
    })
  }

  await logAudit({ action: 'commissions_sessions_payees', entity_type: 'franchise', entity_id: franchiseId, details: { total, lignes: (aPayer || []).length } })
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  revalidatePath('/dashboard/franchises')
  return { success: true, data: { total } }
}

// ─── Versements datés ───────────────────────────────────────────────────────

const JOUR = /^\d{4}-\d{2}-\d{2}$/
/** Jour à Paris (AAAA-MM-JJ) d'un instant. */
const jourParis = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d)
/** Un jour de versement stocké à midi UTC : il reste le même jour à Paris, été comme hiver. */
const instantDuJour = (jour: string) => `${jour}T12:00:00Z`
const dateFr = (jour: string) => new Date(instantDuJour(jour)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })

function verifierJour(jour: string): string | null {
  if (!JOUR.test(jour) || jourParis(new Date(instantDuJour(jour))) !== jour) return 'Date invalide'
  if (jour > jourParis(new Date())) return 'La date du versement ne peut pas être dans le futur'
  if (jour < '2024-01-01') return 'Date invalide'
  return null
}

/**
 * Note un versement : les commissions choisies (validées, de cette franchise)
 * passent en « versées » au jour indiqué, aujourd'hui ou plus tôt pour un
 * paiement déjà fait. La franchise n'est prévenue par mail que si on le demande.
 */
export async function noterVersementAction(
  franchiseId: string,
  saisie: { sessionIds: string[]; jour: string; prevenir: boolean },
): Promise<Result> {
  const session = await getSession()
  if (!peutGerer(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  const ids = Array.from(new Set((saisie?.sessionIds || []).filter((x) => typeof x === 'string')))
  if (!ids.length) return { success: false, error: 'Choisissez au moins une commission' }
  if (ids.length > 500) return { success: false, error: 'Trop de commissions en une fois' }
  const erreurJour = verifierJour(String(saisie?.jour || ''))
  if (erreurJour) return { success: false, error: erreurJour }

  const supabase = await createServiceRoleClient()
  const { data: lignes, error: eLecture } = await supabase.from('commissions_sessions')
    .select('id, session_id, commission_montant')
    .eq('organization_id', orgId).eq('franchise_id', franchiseId).eq('status', 'validee').in('session_id', ids)
  if (eLecture) return { success: false, error: 'Lecture des commissions impossible' }
  if ((lignes || []).length !== ids.length) {
    return { success: false, error: 'Certaines commissions ne sont plus à verser : rechargez la page.' }
  }

  const { error } = await supabase.from('commissions_sessions')
    .update({ status: 'payee', payee_at: instantDuJour(saisie.jour), updated_at: new Date().toISOString() })
    .in('id', (lignes || []).map((l: any) => l.id)).eq('organization_id', orgId).eq('status', 'validee')
  if (error) return { success: false, error: 'Enregistrement impossible' }

  const total = (lignes || []).reduce((t: number, l: any) => t + Number(l.commission_montant || 0), 0)
  if (saisie.prevenir && total > 0) {
    await notifyFranchiseUsers(supabase, franchiseId, orgId, {
      titre: 'Commissions versées',
      message: `Un versement de ${fmtEuro(total)} TTC de commissions a été effectué le ${dateFr(saisie.jour)}.`,
      type: 'success',
      lienUrl: '/franchise/financier',
      lienLabel: 'Voir mes commissions',
      email: {
        subject: `Versement de commissions — ${fmtEuro(total)}`,
        docTitle: 'Versement de commissions',
        intro: `Un versement vient d'être effectué pour ${ids.length > 1 ? `${ids.length} commissions` : 'une commission'} de votre réseau.`,
        metadata: [['Montant total', fmtEuro(total)], ['Date du versement', dateFr(saisie.jour)]],
        ctaLabel: 'Voir mes commissions',
      },
    })
  }

  await logAudit({
    action: 'commissions_sessions_payees', entity_type: 'franchise', entity_id: franchiseId,
    details: { total, lignes: ids.length, verse_le: saisie.jour, franchise_prevenue: !!saisie.prevenir },
  })
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  revalidatePath('/dashboard/franchises')
  return { success: true, data: { total, lignes: ids.length } }
}

/**
 * Corrige la date d'un versement déjà noté (toutes ses commissions), par
 * exemple un paiement fait le 8 septembre mais noté plus tard. Aucun mail.
 * `ancienJour` : 'aucune' pour des commissions versées sans date.
 */
export async function changerDateVersementAction(franchiseId: string, ancienJour: string, nouveauJour: string): Promise<Result> {
  const session = await getSession()
  if (!peutGerer(session.user.role)) return { success: false, error: 'Accès non autorisé' }
  const orgId = session.organization.id
  if (ancienJour !== 'aucune' && !JOUR.test(String(ancienJour))) return { success: false, error: 'Versement introuvable' }
  const erreurJour = verifierJour(String(nouveauJour || ''))
  if (erreurJour) return { success: false, error: erreurJour }
  if (ancienJour === nouveauJour) return { success: true, data: { lignes: 0 } }

  const supabase = await createServiceRoleClient()
  const { data: payees, error: eLecture } = await supabase.from('commissions_sessions')
    .select('id, payee_at, commission_montant')
    .eq('organization_id', orgId).eq('franchise_id', franchiseId).eq('status', 'payee')
  if (eLecture) return { success: false, error: 'Lecture des commissions impossible' }
  const visees = ((payees || []) as any[]).filter((l) =>
    ancienJour === 'aucune' ? !l.payee_at : !!l.payee_at && jourParis(new Date(l.payee_at)) === ancienJour)
  if (!visees.length) return { success: false, error: 'Versement introuvable : rechargez la page.' }

  const { error } = await supabase.from('commissions_sessions')
    .update({ payee_at: instantDuJour(nouveauJour), updated_at: new Date().toISOString() })
    .in('id', visees.map((l) => l.id)).eq('organization_id', orgId).eq('status', 'payee')
  if (error) return { success: false, error: 'Enregistrement impossible' }

  const total = visees.reduce((t, l) => t + Number(l.commission_montant || 0), 0)
  await logAudit({
    action: 'commissions_versement_date', entity_type: 'franchise', entity_id: franchiseId,
    details: { ancien: ancienJour, nouveau: nouveauJour, lignes: visees.length, total },
  })
  revalidatePath(`/dashboard/franchises/${franchiseId}`)
  revalidatePath('/dashboard/franchises')
  return { success: true, data: { lignes: visees.length } }
}
