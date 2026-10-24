'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSession, type SessionContext } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

/**
 * Branchement des canaux publicitaires (page Leads > Canaux). Réservé au
 * super administrateur : on y manipule les jetons de Meta et la clé de
 * Google Ads. Comme toute action exportée, chacune vérifie elle-même le rôle.
 * Les jetons ne repartent jamais vers le navigateur, sauf la clé Google Ads
 * que l'administrateur doit coller dans Google Ads (lecture journalisée).
 */
const peutBrancher = (session: SessionContext) => session.user.role === 'super_admin'
const REFUS = { success: false, error: 'Réservé au super administrateur' } as const

function nettoyerJeton(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, '').slice(0, max)
}

/** Pages Facebook que le jeton permet de lire (pour choisir celle à brancher). */
export async function pagesMetaAction(appId: string, appSecret: string, jeton: string): Promise<ActionResult<{ app: string; pages: { id: string; nom: string }[] }>> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const id = nettoyerJeton(appId, 20)
  const secret = nettoyerJeton(appSecret, 64)
  const jetonPropre = nettoyerJeton(jeton, 1000)
  if (jetonPropre.length < 20) return { success: false, error: 'Collez le jeton d’accès généré dans Meta.' }
  try {
    const { verifierApp, pagesAccessibles } = await import('@/lib/prospects/meta')
    const app = await verifierApp(id, secret)
    const pages = await pagesAccessibles(jetonPropre)
    if (!pages.length) {
      return { success: false, error: 'Ce jeton ne donne accès à aucune Page Facebook. Ajoutez la Page à l’utilisateur système (Paramètres de l’entreprise > Utilisateurs système > Ajouter des éléments), puis générez un nouveau jeton.' }
    }
    return { success: true, data: { app, pages: pages.map((p) => ({ id: p.id, nom: p.nom })) } }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Meta ne répond pas' }
  }
}

/** Branche la Page choisie : abonnements chez Meta, secrets chiffrés, premier relevé. */
export async function connecterMetaAction(appId: string, appSecret: string, jeton: string, pageId: string): Promise<ActionResult<{ page: string; formulaires: number; webhookDeclare: boolean; importes: number; essais: number }>> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const id = nettoyerJeton(appId, 20)
  const secret = nettoyerJeton(appSecret, 64)
  const jetonPropre = nettoyerJeton(jeton, 1000)
  const supabase = await createServiceRoleClient()
  try {
    const { verifierApp, pagesAccessibles, connecterMeta, lireCanalMeta, releverMeta } = await import('@/lib/prospects/meta')
    await verifierApp(id, secret)
    // Le jeton de Page est relu côté serveur : il ne passe jamais par le navigateur
    const page = (await pagesAccessibles(jetonPropre)).find((p) => p.id === String(pageId))
    if (!page) return { success: false, error: 'Page introuvable avec ce jeton : recommencez la recherche des Pages.' }
    const r = await connecterMeta(supabase, session.organization.id, { appId: id, appSecret: secret, page, userId: session.user.id })
    await logAudit({ action: 'connecter_meta', entity_type: 'organization', entity_id: session.organization.id, details: { page_id: page.id, page: page.nom, formulaires: r.formulaires, webhook: r.webhookDeclare } })
    // Premier relevé : les prospects des 90 derniers jours (conservation chez Meta)
    let importes = 0
    let essais = 0
    const canal = await lireCanalMeta(supabase, session.organization.id)
    if (canal) { const b = await releverMeta(supabase, canal); importes = b.nouveaux; essais = b.essais }
    revalidatePath('/dashboard/leads')
    revalidatePath('/dashboard/leads/canaux')
    return { success: true, data: { page: page.nom, formulaires: r.formulaires, webhookDeclare: r.webhookDeclare, importes, essais }, ...(r.avertissement ? { warning: r.avertissement } : {}) }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Le branchement a échoué' }
  }
}

/**
 * Relève tout de suite les prospects Meta (sans attendre le passage des 10
 * minutes). `rattrapage` : relit les 90 derniers jours, toute la durée de
 * conservation chez Meta (le jour où l'accès avancé est accordé, par exemple).
 */
export async function releverMetaAction(rattrapage = false): Promise<ActionResult<{ formulaires: number; lus: number; nouveaux: number; essais: number; erreurs: number }>> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const { lireCanalMeta, releverMeta } = await import('@/lib/prospects/meta')
  const canal = await lireCanalMeta(supabase, session.organization.id)
  if (!canal?.actif) return { success: false, error: 'Meta n’est pas branché' }
  const b = await releverMeta(supabase, canal, rattrapage === true ? { depuis: new Date(Date.now() - 90 * 86400000) } : {})
  if (rattrapage === true) await logAudit({ action: 'rattraper_meta', entity_type: 'organization', entity_id: session.organization.id, details: { lus: b.lus, nouveaux: b.nouveaux, essais: b.essais } })
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/leads/canaux')
  if (b.message) return { success: false, error: b.message }
  return { success: true, data: { formulaires: b.formulaires, lus: b.lus, nouveaux: b.nouveaux, essais: b.essais, erreurs: b.erreurs } }
}

export async function deconnecterMetaAction(): Promise<ActionResult> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const { deconnecterMeta } = await import('@/lib/prospects/meta')
  await deconnecterMeta(supabase, session.organization.id)
  await logAudit({ action: 'deconnecter_meta', entity_type: 'organization', entity_id: session.organization.id })
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/leads/canaux')
  return { success: true }
}

/** Crée (ou remplace) la clé du webhook Google Ads ; l'ancienne cesse aussitôt de fonctionner. */
export async function genererCleGoogleAction(): Promise<ActionResult<{ cle: string }>> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const { nouvelleCleGoogle, enregistrerCleGoogle } = await import('@/lib/prospects/google-ads')
  const cle = nouvelleCleGoogle()
  try { await enregistrerCleGoogle(supabase, session.organization.id, cle, session.user.id) } catch (e: any) {
    return { success: false, error: e?.message || 'Enregistrement impossible' }
  }
  await logAudit({ action: 'generer_cle_google_ads', entity_type: 'organization', entity_id: session.organization.id })
  revalidatePath('/dashboard/leads/canaux')
  return { success: true, data: { cle } }
}

/** Montre la clé à coller dans Google Ads ; chaque lecture est journalisée. */
export async function afficherCleGoogleAction(): Promise<ActionResult<{ cle: string }>> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const supabase = await createServiceRoleClient()
  const { lireCleGoogle } = await import('@/lib/prospects/google-ads')
  const cle = await lireCleGoogle(supabase, session.organization.id)
  if (!cle) return { success: false, error: 'Clé illisible ou absente : créez-en une nouvelle.' }
  const journalise = await logAudit({ action: 'afficher_cle_google_ads', entity_type: 'organization', entity_id: session.organization.id })
  if (!journalise) return { success: false, error: 'Lecture non journalisée : réessayez.' }
  return { success: true, data: { cle } }
}

export async function desactiverGoogleAction(): Promise<ActionResult> {
  const session = await getSession()
  if (!peutBrancher(session)) return REFUS
  const supabase = await createServiceRoleClient()
  await supabase.from('canaux_prospects').update({ actif: false, secrets: null, cle_verification: null, updated_at: new Date().toISOString() })
    .eq('organization_id', session.organization.id).eq('canal', 'google_ads')
  await logAudit({ action: 'desactiver_google_ads', entity_type: 'organization', entity_id: session.organization.id })
  revalidatePath('/dashboard/leads/canaux')
  return { success: true }
}
