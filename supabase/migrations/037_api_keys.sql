-- ============================================================
-- 037 — Clés API (ingestion externe : outil d'audit hygiène, etc.)
-- ============================================================
-- Une clé API permet à un outil externe d'envoyer des données au CRM
-- (ex: les audits d'hygiène faits par les formateurs sur le terrain).
--
-- La clé complète (ll_audit_xxxx) n'est affichée qu'une seule fois à la
-- création. On ne stocke que son hash SHA-256 + un préfixe lisible.
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- ex: "Outil audit hygiène"
  key_prefix TEXT NOT NULL,            -- ex: "ll_audit_a1b2" (affiché en clair)
  key_hash TEXT NOT NULL UNIQUE,       -- SHA-256 de la clé complète
  scopes TEXT[] DEFAULT ARRAY['audits:write'],
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
