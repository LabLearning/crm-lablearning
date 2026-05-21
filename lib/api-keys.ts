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
    .select('id, organization_id, scopes, is_active')
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
