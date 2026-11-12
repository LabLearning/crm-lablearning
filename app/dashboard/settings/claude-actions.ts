'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { genererCleClaude, PORTEE_CLAUDE } from '@/lib/api-keys'
import { logAudit } from '@/lib/audit'
import type { ActionResult } from '@/lib/types'

// Clés du connecteur Claude (lecture de tout le CRM) : réservées au super
// administrateur, qui les crée, les voit et les révoque (lib/api-keys verifierCleClaude)

export type CleClaude = {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  last_used_at: string | null
  request_count: number | null
  created_at: string
  /** Auteur suspendu ou qui n'est plus super administrateur : la clé ne marche plus tant que ça dure */
  en_sommeil: boolean
}

async function contexte() {
  const session = await getSession()
  if (session.user.role !== 'super_admin') return null
  return { session, supabase: await createServiceRoleClient() }
}

export async function listerClesClaudeAction(): Promise<ActionResult<CleClaude[]>> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Réservé au super administrateur' }
  const { data, error } = await ctx.supabase.from('api_keys')
    .select('id, name, key_prefix, is_active, last_used_at, request_count, created_at, created_by')
    .eq('organization_id', ctx.session.organization.id)
    .contains('scopes', [PORTEE_CLAUDE])
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: 'Lecture des clés impossible' }
  const auteurs = Array.from(new Set(((data || []) as any[]).map((k) => k.created_by).filter(Boolean)))
  const { data: users } = auteurs.length
    ? await ctx.supabase.from('users').select('id, role, status').in('id', auteurs)
    : { data: [] as any[] }
  const actifs = new Set(((users || []) as any[]).filter((u) => u.role === 'super_admin' && u.status === 'active').map((u) => u.id))
  return {
    success: true,
    data: ((data || []) as any[]).map(({ created_by, ...k }) => ({ ...k, en_sommeil: !!k.is_active && !actifs.has(created_by) })) as CleClaude[],
  }
}

export type LectureClaude = {
  id: string
  le: string
  /** connecteur_claude (lecture), connecteur_claude_plafond (refus au plafond), connecteur_claude_refus (clé révoquée) */
  action: string
  cle: string
  outil: string | null
  table: string | null
  lignes: number | null
  ms: number | null
  erreur: string | null
  arguments: Record<string, unknown> | null
}

export type ConnexionClaude = {
  famille: string
  application: string
  utilisateur: string
  depuis: string
  derniere: string | null
}

/** Connexions actives de l'application Claude (connexion par compte CRM, migration 172) */
export async function listerConnexionsClaudeAction(): Promise<ActionResult<ConnexionClaude[]>> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Réservé au super administrateur' }
  const orgId = ctx.session.organization.id
  // Seules les lignes vivantes : une par connexion active (la rotation révoque les anciennes)
  const { data, error } = await ctx.supabase.from('oauth_tokens')
    .select('famille, client_name, user_id, created_at, last_used_at')
    .eq('organization_id', orgId)
    .is('revoked_at', null)
    .gt('refresh_expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200)
  // Tables absentes tant que la migration 172 n'est pas appliquée : rien à montrer
  if (error) return { success: true, data: [], warning: error.code === '42P01' ? 'migration 172 à appliquer' : 'lecture impossible' }
  const familles = new Map<string, any>()
  for (const t of (data || []) as any[]) if (!familles.has(t.famille)) familles.set(t.famille, t)
  const actives = Array.from(familles.values()).slice(0, 50)
  // Date d'autorisation : le premier jeton de chaque connexion
  const [premiers, { data: users }] = await Promise.all([
    Promise.all(actives.map((f) => ctx.supabase.from('oauth_tokens').select('created_at').eq('famille', f.famille).order('created_at', { ascending: true }).limit(1))),
    ctx.supabase.from('users').select('id, first_name, last_name').in('id', Array.from(new Set(actives.map((f) => f.user_id)))),
  ])
  const nom = new Map(((users || []) as any[]).map((u) => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]))
  return {
    success: true,
    data: actives.map((f, i) => ({
      famille: f.famille,
      application: f.client_name || 'Claude',
      utilisateur: nom.get(f.user_id) || '—',
      depuis: (premiers[i] as any)?.data?.[0]?.created_at || f.created_at,
      derniere: f.last_used_at,
    })),
  }
}

/** Coupe une connexion de l'application Claude : tous ses jetons sont révoqués */
export async function revoquerConnexionClaudeAction(famille: string): Promise<ActionResult> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Réservé au super administrateur' }
  const { data, error } = await ctx.supabase.from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('famille', famille)
    .eq('organization_id', ctx.session.organization.id)
    .is('revoked_at', null)
    .select('id')
  if (error) return { success: false, error: 'Déconnexion impossible' }
  if (!data?.length) return { success: false, error: 'Cette connexion n’est plus active' }
  await logAudit({ action: 'deconnecter_claude', entity_type: 'connecteur', details: { connexion: famille } })
  revalidatePath('/dashboard/settings')
  return { success: true }
}

/** Les 50 derniers appels du connecteur (lectures et refus), pour le super administrateur */
export async function journalConnecteurClaudeAction(): Promise<ActionResult<LectureClaude[]>> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Réservé au super administrateur' }
  const orgId = ctx.session.organization.id
  const [{ data, error }, { data: cles }] = await Promise.all([
    ctx.supabase.from('audit_logs')
      .select('id, created_at, action, entity_id, details')
      .eq('organization_id', orgId)
      .eq('entity_type', 'connecteur_claude')
      .order('created_at', { ascending: false })
      .limit(50),
    ctx.supabase.from('api_keys').select('id, name, key_prefix').eq('organization_id', orgId).contains('scopes', [PORTEE_CLAUDE]),
  ])
  if (error) return { success: false, error: 'Lecture du journal impossible' }
  const nomCle = new Map<string, string>(((cles || []) as any[]).map((k) => [k.id, k.name || k.key_prefix]))
  // Connexions de l'application citées au journal (une ligne par connexion suffit pour le nom)
  const familles = Array.from(new Set(((data || []) as any[]).map((l) => l.entity_id).filter((id: string) => id && !nomCle.has(id))))
  if (familles.length) {
    const noms = await Promise.all(familles.map((f) => ctx.supabase.from('oauth_tokens').select('client_name').eq('famille', f).limit(1)))
    familles.forEach((f, i) => { const n = (noms[i] as any)?.data?.[0]; if (n) nomCle.set(f, `Application ${n.client_name || 'Claude'}`) })
  }
  return {
    success: true,
    data: ((data || []) as any[]).map((l) => {
      const d = l.details || {}
      return {
        id: l.id,
        le: l.created_at,
        action: l.action,
        cle: nomCle.get(l.entity_id) || 'accès supprimé',
        outil: d.outil ?? null,
        table: d.table ?? null,
        lignes: typeof d.lignes === 'number' ? d.lignes : null,
        ms: typeof d.ms === 'number' ? d.ms : null,
        erreur: d.erreur || d.refus || d.motif || null,
        arguments: d.arguments && typeof d.arguments === 'object' ? d.arguments : null,
      }
    }),
  }
}

/** Crée une clé ; la clé complète n'est rendue qu'ici, une seule fois */
export async function creerCleClaudeAction(nom: string): Promise<ActionResult<{ cle: string }>> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Réservé au super administrateur' }
  const libelle = String(nom || '').trim().slice(0, 80) || 'Claude'
  const { full, prefix, hash } = genererCleClaude()
  const { data, error } = await ctx.supabase.from('api_keys').insert({
    organization_id: ctx.session.organization.id,
    name: libelle,
    key_prefix: prefix,
    key_hash: hash,
    scopes: [PORTEE_CLAUDE],
    created_by: ctx.session.user.id,
  }).select('id').single()
  if (error || !data) return { success: false, error: 'Création de la clé impossible' }
  await logAudit({ action: 'create', entity_type: 'api_key', entity_id: data.id, details: { connecteur: 'claude', nom: libelle, prefixe: prefix } })
  revalidatePath('/dashboard/settings')
  return { success: true, data: { cle: full } }
}

export async function revoquerCleClaudeAction(id: string): Promise<ActionResult> {
  const ctx = await contexte()
  if (!ctx) return { success: false, error: 'Réservé au super administrateur' }
  const { data, error } = await ctx.supabase.from('api_keys')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', ctx.session.organization.id)
    .contains('scopes', [PORTEE_CLAUDE])
    .select('id')
  if (error || !data?.length) return { success: false, error: 'Révocation impossible' }
  await logAudit({ action: 'revoke', entity_type: 'api_key', entity_id: id, details: { connecteur: 'claude' } })
  revalidatePath('/dashboard/settings')
  return { success: true }
}
