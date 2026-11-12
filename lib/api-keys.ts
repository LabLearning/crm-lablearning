import { createHash, randomBytes } from 'crypto'

/**
 * Clés API pour l'ingestion externe (outil d'audit hygiène, etc.).
 * Format : ll_audit_<32 hex>. Seul le hash SHA-256 est stocké en base.
 */

export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const random = randomBytes(24).toString('hex') // 48 chars
  const full = `ll_audit_${random}`
  const prefix = full.slice(0, 16) // ll_audit_xxxxxx (affiché en clair)
  const hash = hashApiKey(full)
  return { full, prefix, hash }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}

/**
 * Vérifie une clé API et retourne le contexte org si valide.
 * Met à jour last_used_at / request_count.
 */
export async function verifyApiKey(
  supabase: any,
  rawKey: string,
  requiredScope?: string,
): Promise<{ organizationId: string; keyId: string } | null> {
  if (!rawKey) return null
  const key = rawKey.replace(/^Bearer\s+/i, '').trim()
  if (!key.startsWith('ll_audit_')) return null

  const hash = hashApiKey(key)
  const { data: row } = await supabase
    .from('api_keys')
    .select('id, organization_id, scopes, is_active, request_count')
    .eq('key_hash', hash)
    .eq('is_active', true)
    .maybeSingle()

  if (!row) return null
  if (requiredScope && Array.isArray(row.scopes) && !row.scopes.includes(requiredScope)) return null

  // Tracking usage (best-effort)
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString(), request_count: (row.request_count || 0) + 1 })
    .eq('id', row.id)

  return { organizationId: row.organization_id, keyId: row.id }
}

// ════════════════════════════════════════════════════════════
// CONNECTEUR CLAUDE (lecture de tout le CRM, /api/mcp)
// ════════════════════════════════════════════════════════════

const PREFIXE_CLAUDE = 'll_claude_'
export const PORTEE_CLAUDE = 'crm:read'

/** Clé du connecteur Claude : ll_claude_<48 hex>, seule l'empreinte est stockée */
export function genererCleClaude(): { full: string; prefix: string; hash: string } {
  const full = `${PREFIXE_CLAUDE}${randomBytes(24).toString('hex')}`
  return { full, prefix: full.slice(0, 18), hash: hashApiKey(full) }
}

export type VerificationCleClaude =
  | { etat: 'ok'; organizationId: string; userId: string; cleId: string }
  /** Clé connue mais révoquée, ou auteur suspendu ou sans rôle : la tentative mérite une trace */
  | { etat: 'refusee'; organizationId: string; cleId: string }
  | { etat: 'inconnue' }
  /** La base ne répond pas : ce n'est pas la clé qui est en cause */
  | { etat: 'indisponible' }

/**
 * Vérifie une clé du connecteur Claude : active, de portée crm:read, et créée
 * par un super administrateur encore actif de la même organisation. Une clé
 * dont l'auteur est suspendu ou a changé de rôle cesse de marcher d'elle-même.
 * `connexion` (message initialize) compte une connexion ; sinon la date de
 * dernière utilisation n'est rafraîchie qu'une fois par minute.
 */
export async function verifierCleClaude(
  supabase: any,
  entete: string | null,
  connexion = false,
): Promise<VerificationCleClaude> {
  const cle = String(entete || '').replace(/^Bearer\s+/i, '').trim()
  if (!/^ll_claude_[a-f0-9]{48}$/.test(cle)) return { etat: 'inconnue' }

  const { data: row, error } = await supabase
    .from('api_keys')
    .select('id, organization_id, scopes, created_by, is_active, request_count, last_used_at')
    .eq('key_hash', hashApiKey(cle))
    .maybeSingle()
  if (error) return { etat: 'indisponible' }
  if (!row || !Array.isArray(row.scopes) || !row.scopes.includes(PORTEE_CLAUDE)) return { etat: 'inconnue' }
  if (!row.is_active || !row.created_by) return { etat: 'refusee', organizationId: row.organization_id, cleId: row.id }

  const { data: auteur, error: errAuteur } = await supabase
    .from('users')
    .select('id, role, status, organization_id')
    .eq('id', row.created_by)
    .maybeSingle()
  if (errAuteur) return { etat: 'indisponible' }
  if (!auteur || auteur.role !== 'super_admin' || auteur.status !== 'active' || auteur.organization_id !== row.organization_id) {
    return { etat: 'refusee', organizationId: row.organization_id, cleId: row.id }
  }

  const maintenant = Date.now()
  const recente = row.last_used_at && maintenant - new Date(row.last_used_at).getTime() < 60_000
  if (connexion || !recente) {
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date(maintenant).toISOString(),
        ...(connexion ? { request_count: (row.request_count || 0) + 1 } : {}),
      })
      .eq('id', row.id)
  }

  return { etat: 'ok', organizationId: row.organization_id, userId: auteur.id, cleId: row.id }
}
