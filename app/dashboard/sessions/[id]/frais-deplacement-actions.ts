'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

// Frais de déplacement du formateur d'une session (demande de Brahim du
// 10/11/2026, NST Angers) : le contrat signé garde son montant, le déplacement
// se saisit à part. Une ligne session_frais « déplacement » rattachée au
// formateur, que la marge et la commission franchise (budget net) déduisent
// (lib/commission sommeFraisDeplacementFormateur). Mêmes rôles que la
// rémunération du formateur (updateCoutFormateurAction).

const LIBELLE = 'Frais de déplacement du formateur'
const ROLES = ['super_admin', 'gestionnaire', 'directeur_commercial']

async function contexte(sessionId: string) {
  const session = await getSession()
  if (!ROLES.includes(session.user.role)) return null
  const supabase = await createServiceRoleClient()
  const orgId = session.organization.id
  const { data: sess } = await supabase.from('sessions').select('id, formateur_id')
    .eq('id', sessionId).eq('organization_id', orgId).maybeSingle()
  if (!sess) return null
  return { session, supabase, orgId, sess }
}

/**
 * Les lignes « déplacement » du formateur actuel, soit exactement ce que la
 * commission déduit (lib/commission sommeFraisDeplacementFormateur) : la ligne
 * de la case (la plus ancienne qui porte son libellé) et les autres.
 */
async function lignesDeplacement(supabase: any, orgId: string, sessionId: string, formateurId: string) {
  const { data, error } = await supabase.from('session_frais').select('id, libelle, montant')
    .eq('session_id', sessionId).eq('organization_id', orgId)
    .eq('categorie', 'deplacement').eq('formateur_id', formateurId)
    .order('created_at', { ascending: true })
  if (error) return null
  const lignes = (data || []) as any[]
  const caseLigne = lignes.find((l) => l.libelle === LIBELLE) || null
  const autres = lignes.filter((l) => l !== caseLigne).reduce((t, l) => t + (Number(l.montant) || 0), 0)
  return { caseLigne, autres: Math.round(autres * 100) / 100 }
}

/** Frais de déplacement du formateur : la case, et les autres déplacements saisis à part */
export async function lireFraisDeplacementFormateurAction(sessionId: string): Promise<ActionResult & {
  data?: { montant: number | null; autres: number; formateur: boolean }
}> {
  const ctx = await contexte(sessionId)
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { supabase, orgId, sess } = ctx
  if (!sess.formateur_id) return { success: true, data: { montant: null, autres: 0, formateur: false } }

  const l = await lignesDeplacement(supabase, orgId, sessionId, sess.formateur_id)
  if (!l) return { success: false, error: 'Lecture des frais impossible' }
  return { success: true, data: { montant: l.caseLigne ? Number(l.caseLigne.montant) : null, autres: l.autres, formateur: true } }
}

/**
 * Fixe les frais de déplacement du formateur (vide ou 0 : la case est
 * effacée). Ne touche jamais au contrat ; la commission franchise de la
 * session est recalculée tout de suite. Une commission validée ou payée reste
 * figée : l'action le dit, au lieu d'annoncer une déduction qui n'a pas lieu.
 */
export async function definirFraisDeplacementFormateurAction(sessionId: string, montant: number | null): Promise<ActionResult> {
  const ctx = await contexte(sessionId)
  if (!ctx) return { success: false, error: 'Accès non autorisé' }
  const { session, supabase, orgId, sess } = ctx
  if (!sess.formateur_id) return { success: false, error: "Choisissez d'abord le formateur de la session" }
  if (montant !== null && (!Number.isFinite(montant) || montant < 0 || montant > 100000)) {
    return { success: false, error: 'Montant invalide' }
  }
  const valeur = montant ? Math.round(montant * 100) / 100 : null
  // Une faute de frappe (0,004) n'efface pas la ligne : elle est refusée
  if (valeur === 0) return { success: false, error: 'Montant invalide (0,01 € au minimum)' }

  const l = await lignesDeplacement(supabase, orgId, sessionId, sess.formateur_id)
  if (!l) return { success: false, error: 'Lecture des frais impossible' }
  const existante = l.caseLigne
  const avant = existante ? Number(existante.montant) : null
  if (avant === valeur) return { success: true }

  let erreur: any = null
  if (valeur === null) {
    if (existante) erreur = (await supabase.from('session_frais').delete().eq('id', existante.id)).error
  } else if (existante) {
    erreur = (await supabase.from('session_frais')
      .update({ montant: valeur, updated_at: new Date().toISOString() }).eq('id', existante.id)).error
  } else {
    erreur = (await supabase.from('session_frais').insert({
      organization_id: orgId,
      session_id: sessionId,
      categorie: 'deplacement',
      libelle: LIBELLE,
      montant: valeur,
      formateur_id: sess.formateur_id,
      created_by: session.user.id,
    })).error
  }
  if (erreur) {
    console.error('[frais déplacement formateur]', erreur.message)
    return { success: false, error: 'Enregistrement impossible' }
  }

  await logAudit({ action: 'frais_deplacement_formateur', entity_type: 'session', entity_id: sessionId, details: { avant, apres: valeur } })

  let warning: string | undefined
  try {
    const { recalcSessionCommission } = await import('@/lib/commission')
    const com = await recalcSessionCommission(supabase, sessionId, orgId)
    if (com && com.type === 'budget_net' && (com.status === 'validee' || com.status === 'payee')) {
      warning = com.status === 'payee'
        ? 'Frais enregistrés, sans toucher au contrat. La commission de la franchise est déjà payée : elle reste figée (sauf « Annuler paiement » sur la fiche franchise).'
        : 'Frais enregistrés, sans toucher au contrat. La commission de la franchise est validée : elle ne reprendra ce changement qu’après « Annuler la validation » sur la fiche franchise.'
    }
  } catch (e) {
    console.error('[frais déplacement → commission franchise]', e)
  }
  revalidatePath(`/dashboard/sessions/${sessionId}`)
  revalidatePath('/dashboard/rentabilite')
  revalidatePath('/dashboard/franchises', 'layout')
  return { success: true, warning }
}
