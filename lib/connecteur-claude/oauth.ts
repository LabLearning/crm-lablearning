import { createHash, randomBytes, randomUUID } from 'crypto'

/**
 * Connexion de Claude au CRM par compte (OAuth 2.1, PKCE obligatoire), pour
 * l'application Claude qui ne peut pas envoyer de clé en en-tête. Le CRM est
 * son propre serveur d'autorisation : identités publiées de Claude (CIMD) et
 * enregistrement dynamique, page /oauth/authorize (super administrateur
 * connecté), jetons opaques dont seules les empreintes sont stockées
 * (migration 172). Messages d'erreur OAuth en ASCII (RFC 6749).
 */

export const PORTEE = 'crm:read'
/** Le state revient à Claude tel quel : jamais tronqué (un state coupé fait échouer le retour) */
const TAILLE_STATE_MAX = 4096
const DUREE_CODE_MS = 10 * 60_000
// Jeton d'accès de 8 h : chaque appel revérifie l'auteur et la révocation, un accès plus long ne retarde aucune coupure
const DUREE_ACCES_S = 8 * 3600
const DUREE_RENOUVELLEMENT_MS = 60 * 86_400_000

export function baseCrm(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://crm.lab-learning.fr').replace(/\/$/, '')
}
/** L'adresse du connecteur telle qu'elle se saisit dans Claude */
export const ressourceMcp = () => `${baseCrm()}/api/mcp`
/** Adresse normalisée des métadonnées de la ressource (RFC 9728 § 3.1), servie par la réécriture de next.config.js */
export const adresseMetadonneesRessource = () => `${baseCrm()}/.well-known/oauth-protected-resource/api/mcp`

export const empreinte = (s: string) => createHash('sha256').update(s).digest('hex')
const aleatoire = (octets: number) => randomBytes(octets).toString('hex')

/**
 * Identités publiées de Claude (Client ID Metadata Documents), relevées le
 * 12/11/2026 sur claude.ai : l'application (web, ordinateur, téléphone) et
 * Claude Code. Seules ces deux adresses sont acceptées comme client_id-URL.
 */
const CLIENTS_PUBLIES: Record<string, { nom: string; redirections: string[] }> = {
  'https://claude.ai/oauth/mcp-oauth-client-metadata': { nom: 'Claude', redirections: ['https://claude.ai/api/mcp/auth_callback'] },
  'https://claude.ai/oauth/claude-code-client-metadata': { nom: 'Claude Code', redirections: ['http://localhost/callback', 'http://127.0.0.1/callback'] },
}

/**
 * Adresses de retour acceptées : celle des applications Claude (web, ordinateur,
 * téléphone) et le retour local de Claude Code, sur n'importe quel port.
 */
export function redirectionAutorisee(uri: unknown): boolean {
  if (typeof uri !== 'string' || uri.length > 300) return false
  let u: URL
  try { u = new URL(uri) } catch { return false }
  if (u.search || u.hash || u.username || u.password) return false
  if (u.protocol === 'https:' && (u.hostname === 'claude.ai' || u.hostname === 'claude.com') && !u.port && u.pathname === '/api/mcp/auth_callback') return true
  if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.pathname === '/callback') return true
  return false
}

export const estLocale = (u: URL) => u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')

/** L'adresse demandée correspond-elle à une adresse enregistrée ? Exacte, sauf le port d'un retour local (RFC 8252) */
export function redirectionEnregistree(demandee: string, enregistrees: string[]): boolean {
  if (!redirectionAutorisee(demandee)) return false
  const d = new URL(demandee)
  return enregistrees.some((e) => {
    if (e === demandee) return true
    try {
      const r = new URL(e)
      return estLocale(d) && estLocale(r) && r.hostname === d.hostname && r.pathname === d.pathname
    } catch { return false }
  })
}

/** Défi PKCE : base64url(SHA-256(vérificateur)) */
export function defiPkce(verificateur: string): string {
  return createHash('sha256').update(verificateur).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const verificateurValide = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(v)
export const defiValide = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9\-_]{43,128}$/.test(v)

type Client = { client_id: string; client_name: string; redirect_uris: string[] }

/** Client : identité publiée de Claude, ou client enregistré dynamiquement */
async function clientPour(supabase: any, client_id: string): Promise<{ etat: 'ok'; client: Client } | { etat: 'inconnu' } | { etat: 'indisponible' }> {
  const publie = CLIENTS_PUBLIES[client_id]
  if (publie) return { etat: 'ok', client: { client_id, client_name: publie.nom, redirect_uris: publie.redirections } }
  if (!client_id.startsWith('ll_client_') || client_id.length > 100) return { etat: 'inconnu' }
  const { data, error } = await supabase.from('oauth_clients').select('client_id, client_name, redirect_uris').eq('client_id', client_id).maybeSingle()
  if (error) return { etat: 'indisponible' }
  if (!data) return { etat: 'inconnu' }
  return { etat: 'ok', client: { client_id, client_name: String(data.client_name || 'Claude').slice(0, 100), redirect_uris: data.redirect_uris || [] } }
}

export type DemandeAutorisation = {
  client_id: string
  client_name: string
  redirect_uri: string
  code_challenge: string
  state: string | null
  scope: string
  resource: string | null
}

/**
 * Vérifie une demande d'autorisation venue du navigateur (jamais crue sur
 * parole, ni à l'affichage ni à la validation). `redirection` n'est rendue
 * que si l'adresse de retour est sûre : sinon l'erreur s'affiche sur place.
 */
export async function verifierDemande(supabase: any, p: Record<string, unknown>): Promise<
  | { ok: true; demande: DemandeAutorisation }
  | { ok: false; erreur: string; redirection?: string }
> {
  const client_id = typeof p.client_id === 'string' ? p.client_id : ''
  const redirect_uri = typeof p.redirect_uri === 'string' ? p.redirect_uri : ''
  if (!client_id) return { ok: false, erreur: 'Demande incomplète : application inconnue.' }
  const c = await clientPour(supabase, client_id)
  if (c.etat === 'indisponible') return { ok: false, erreur: 'Service momentanément indisponible, réessayez dans un instant.' }
  if (c.etat === 'inconnu') return { ok: false, erreur: 'Application inconnue : relancez la connexion depuis Claude.' }
  if (!redirectionEnregistree(redirect_uri, c.client.redirect_uris)) return { ok: false, erreur: 'Adresse de retour non autorisée.' }
  if (typeof p.state === 'string' && p.state.length > TAILLE_STATE_MAX) return { ok: false, erreur: 'Demande invalide : relancez la connexion depuis Claude.' }

  const state = typeof p.state === 'string' && p.state ? p.state : null
  const retour = (code: string, description: string) => {
    const u = new URL(redirect_uri)
    u.searchParams.set('error', code)
    u.searchParams.set('error_description', description)
    if (state) u.searchParams.set('state', state)
    return u.toString()
  }
  if (p.response_type !== 'code') return { ok: false, erreur: 'Type de réponse non pris en charge.', redirection: retour('unsupported_response_type', 'response_type=code is required') }
  if (p.code_challenge_method !== 'S256' || !defiValide(p.code_challenge)) return { ok: false, erreur: 'Défi PKCE absent ou invalide.', redirection: retour('invalid_request', 'PKCE S256 is required') }
  const resource = typeof p.resource === 'string' && p.resource ? p.resource : null
  if (resource && resource.replace(/\/$/, '') !== ressourceMcp()) return { ok: false, erreur: 'Ressource inconnue.', redirection: retour('invalid_target', 'unknown resource') }
  // Portées inconnues ignorées (RFC 6749 § 3.3) : seule la lecture est accordée, et le jeton l'indique
  return {
    ok: true,
    demande: { client_id, client_name: c.client.client_name, redirect_uri, code_challenge: p.code_challenge as string, state, scope: PORTEE, resource },
  }
}

type Utilisateur = { id: string; role: string; status: string; organization_id: string; first_name: string | null }

/**
 * Utilisateur autorisé à brancher Claude : super administrateur actif (le
 * connecteur lit tout le CRM). Une panne de la base n'est jamais prise pour un refus.
 */
export async function utilisateurAutorise(supabase: any, userId: string | null | undefined): Promise<
  { etat: 'ok'; user: Utilisateur } | { etat: 'refuse' } | { etat: 'indisponible' }
> {
  if (!userId) return { etat: 'refuse' }
  const { data: u, error } = await supabase.from('users').select('id, role, status, organization_id, first_name').eq('id', userId).maybeSingle()
  if (error) return { etat: 'indisponible' }
  if (!u || u.role !== 'super_admin' || u.status !== 'active') return { etat: 'refuse' }
  return { etat: 'ok', user: u as Utilisateur }
}

/** Crée le code d'autorisation (seule son empreinte est stockée) et rend l'adresse de retour */
export async function emettreCode(supabase: any, d: DemandeAutorisation, user: { id: string; organization_id: string }): Promise<string | null> {
  const code = aleatoire(32)
  const { error } = await supabase.from('oauth_codes').insert({
    code_hash: empreinte(code),
    client_id: d.client_id,
    user_id: user.id,
    organization_id: user.organization_id,
    redirect_uri: d.redirect_uri,
    code_challenge: d.code_challenge,
    scope: d.scope,
    resource: d.resource,
    expires_at: new Date(Date.now() + DUREE_CODE_MS).toISOString(),
  })
  if (error) { console.error('[oauth] code', error.message); return null }
  const u = new URL(d.redirect_uri)
  u.searchParams.set('code', code)
  if (d.state) u.searchParams.set('state', d.state)
  return u.toString()
}

type ReponseJetons = { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string }

async function emettreJetons(supabase: any, base: { famille: string; client_id: string; client_name: string | null; user_id: string; organization_id: string }): Promise<ReponseJetons | null> {
  const acces = `ll_oauth_${aleatoire(24)}`
  const renouvellement = `ll_refresh_${aleatoire(32)}`
  const { error } = await supabase.from('oauth_tokens').insert({
    ...base,
    access_hash: empreinte(acces),
    refresh_hash: empreinte(renouvellement),
    scope: PORTEE,
    access_expires_at: new Date(Date.now() + DUREE_ACCES_S * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + DUREE_RENOUVELLEMENT_MS).toISOString(),
  })
  if (error) { console.error('[oauth] jetons', error.message); return null }
  return { access_token: acces, token_type: 'Bearer', expires_in: DUREE_ACCES_S, refresh_token: renouvellement, scope: PORTEE }
}

export type ErreurJeton = {
  erreur: 'invalid_request' | 'invalid_grant' | 'invalid_client' | 'invalid_target' | 'unsupported_grant_type' | 'server_error'
  description: string
}
const indisponible: ErreurJeton = { erreur: 'server_error', description: 'temporarily unavailable, retry later' }

/**
 * Échange d'un code d'autorisation : usage unique, même adresse de retour, PKCE
 * vérifié. Le client_id d'un client public n'authentifie rien : s'il manque, le
 * code reste lié à son client ; s'il est donné, il doit être le même.
 */
export async function echangerCode(supabase: any, p: Record<string, string>): Promise<ReponseJetons | ErreurJeton> {
  const { code, redirect_uri, client_id, code_verifier } = p
  if (!code || !redirect_uri || !verificateurValide(code_verifier)) return { erreur: 'invalid_request', description: 'code, redirect_uri and code_verifier are required' }
  if (p.resource && p.resource.replace(/\/$/, '') !== ressourceMcp()) return { erreur: 'invalid_target', description: 'unknown resource' }
  // Consommation atomique : un code rejoué ne passe jamais deux fois
  const { data: lignes, error } = await supabase.from('oauth_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', empreinte(code)).is('used_at', null)
    .select('client_id, user_id, organization_id, redirect_uri, code_challenge, expires_at')
  if (error) return indisponible
  const c = (lignes || [])[0]
  if (!c) return { erreur: 'invalid_grant', description: 'unknown or already used code' }
  if (new Date(c.expires_at).getTime() < Date.now()) return { erreur: 'invalid_grant', description: 'expired code' }
  if ((client_id && c.client_id !== client_id) || c.redirect_uri !== redirect_uri) return { erreur: 'invalid_grant', description: 'client or redirect_uri mismatch' }
  if (defiPkce(code_verifier) !== c.code_challenge) return { erreur: 'invalid_grant', description: 'invalid PKCE code_verifier' }
  const u = await utilisateurAutorise(supabase, c.user_id)
  if (u.etat === 'indisponible') return indisponible
  if (u.etat === 'refuse' || u.user.organization_id !== c.organization_id) return { erreur: 'invalid_grant', description: 'account not allowed' }
  const cl = await clientPour(supabase, c.client_id)
  const jetons = await emettreJetons(supabase, { famille: randomUUID(), client_id: c.client_id, client_name: cl.etat === 'ok' ? cl.client.client_name : null, user_id: c.user_id, organization_id: c.organization_id })
  return jetons || indisponible
}

/**
 * Renouvellement avec rotation stricte (OAuth 2.1) : le nouveau couple est
 * inscrit AVANT la révocation atomique de l'ancien. Un jeton déjà renouvelé
 * qui revient est un jeton rejoué, donc peut-être volé : toute la connexion
 * est révoquée. Deux renouvellements parfaitement simultanés du même jeton
 * (les deux l'ont lu encore valable) : le premier à le révoquer gagne ; le
 * second retire son propre couple et reçoit invalid_grant, sans couper la
 * connexion du gagnant ni ouvrir de branche parallèle. Une déconnexion pendant
 * l'échange a déjà révoqué l'ancien couple : le nouveau est retiré de même,
 * rien ne lui survit.
 */
export async function renouveler(supabase: any, p: Record<string, string>): Promise<ReponseJetons | ErreurJeton> {
  const { refresh_token, client_id } = p
  if (!refresh_token) return { erreur: 'invalid_request', description: 'refresh_token is required' }
  const { data: t, error } = await supabase.from('oauth_tokens')
    .select('id, famille, client_id, client_name, user_id, organization_id, refresh_expires_at, revoked_at')
    .eq('refresh_hash', empreinte(refresh_token)).maybeSingle()
  if (error) return indisponible
  if (!t) return { erreur: 'invalid_grant', description: 'unknown refresh_token' }
  if (t.revoked_at) {
    await revoquerFamille(supabase, t.famille)
    return { erreur: 'invalid_grant', description: 'refresh_token already used, connection revoked' }
  }
  // client_id facultatif (client public), mais le même s'il est donné
  if (client_id && t.client_id !== client_id) return { erreur: 'invalid_grant', description: 'client mismatch' }
  if (!t.refresh_expires_at || new Date(t.refresh_expires_at).getTime() < Date.now()) return { erreur: 'invalid_grant', description: 'expired refresh_token' }
  const u = await utilisateurAutorise(supabase, t.user_id)
  if (u.etat === 'indisponible') return indisponible
  if (u.etat === 'refuse' || u.user.organization_id !== t.organization_id) {
    await revoquerFamille(supabase, t.famille)
    return { erreur: 'invalid_grant', description: 'account not allowed' }
  }
  const jetons = await emettreJetons(supabase, { famille: t.famille, client_id: t.client_id, client_name: t.client_name, user_id: t.user_id, organization_id: t.organization_id })
  if (!jetons) return indisponible
  const { data: revoque, error: errRevoque } = await supabase.from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() }).eq('id', t.id).is('revoked_at', null).select('id')
  // Panne au moment de révoquer : l'ancien couple reste valable, on ne coupe rien
  if (errRevoque) return indisponible
  if (!revoque?.length) {
    // Ancien couple révoqué entre-temps (renouvellement simultané gagnant, ou déconnexion) : ce couple-ci est retiré
    const { error: errRetrait } = await supabase.from('oauth_tokens')
      .update({ revoked_at: new Date().toISOString() }).eq('access_hash', empreinte(jetons.access_token))
    if (errRetrait) return indisponible
    return { erreur: 'invalid_grant', description: 'refresh_token already used' }
  }
  return jetons
}

export async function revoquerFamille(supabase: any, famille: string) {
  await supabase.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('famille', famille).is('revoked_at', null)
}

export type VerificationJeton =
  | { etat: 'ok'; organizationId: string; userId: string; famille: string }
  | { etat: 'invalide' }
  | { etat: 'indisponible' }

/** Jeton d'accès présenté au connecteur : connu, non révoqué, non expiré, auteur toujours habilité */
export async function verifierJetonAcces(supabase: any, jeton: string): Promise<VerificationJeton> {
  if (!/^ll_oauth_[a-f0-9]{48}$/.test(jeton)) return { etat: 'invalide' }
  const { data: t, error } = await supabase.from('oauth_tokens')
    .select('id, famille, user_id, organization_id, access_expires_at, revoked_at, last_used_at')
    .eq('access_hash', empreinte(jeton)).maybeSingle()
  if (error) return { etat: 'indisponible' }
  if (!t || t.revoked_at || new Date(t.access_expires_at).getTime() < Date.now()) return { etat: 'invalide' }
  const u = await utilisateurAutorise(supabase, t.user_id)
  if (u.etat === 'indisponible') return { etat: 'indisponible' }
  if (u.etat === 'refuse' || u.user.organization_id !== t.organization_id) return { etat: 'invalide' }
  if (!t.last_used_at || Date.now() - new Date(t.last_used_at).getTime() > 60_000) {
    await supabase.from('oauth_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', t.id)
  }
  return { etat: 'ok', organizationId: t.organization_id, userId: t.user_id, famille: t.famille }
}
