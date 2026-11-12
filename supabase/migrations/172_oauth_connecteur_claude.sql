-- 172 — Connexion de Claude au CRM par compte (OAuth 2.1 avec PKCE)
--
-- Demande de Brahim du 12/11/2026 : l'application Claude n'a pas pu joindre le
-- connecteur, la section « Request headers » (clé en en-tête) n'étant pas
-- ouverte sur son compte. Claude se branche alors comme le recommande
-- Anthropic : il ouvre la page /oauth/authorize du CRM, le super administrateur
-- connecté autorise, et Claude reçoit des jetons courts, renouvelés et
-- révocables. Code : lib/connecteur-claude/oauth.ts, app/api/oauth/*.
-- Seules les empreintes (SHA-256) des codes et des jetons sont stockées.

-- Clients enregistrés par Claude (enregistrement dynamique, RFC 7591)
CREATE TABLE IF NOT EXISTS public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_name text,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Codes d'autorisation : dix minutes, un seul usage, liés au défi PKCE
CREATE TABLE IF NOT EXISTS public.oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  client_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text,
  resource text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Jetons : accès d'une heure, renouvellement à usage unique (rotation).
-- « famille » relie les jetons d'une même connexion : un renouvellement
-- rejoué révoque toute la famille.
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  famille uuid NOT NULL,
  access_hash text NOT NULL UNIQUE,
  refresh_hash text UNIQUE,
  client_id text NOT NULL,
  client_name text,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_famille ON public.oauth_tokens (famille);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_org ON public.oauth_tokens (organization_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expiration ON public.oauth_codes (expires_at);

-- Comptage du plafond d'appels du connecteur (journal de la dernière minute)
CREATE INDEX IF NOT EXISTS idx_audit_logs_connecteur ON public.audit_logs (entity_id, created_at)
  WHERE entity_type = 'connecteur_claude';

-- Aucune lecture ni écriture par l'API publique : seul le serveur (clé de service) y touche
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_clients FROM anon, authenticated;
REVOKE ALL ON public.oauth_codes FROM anon, authenticated;
REVOKE ALL ON public.oauth_tokens FROM anon, authenticated;
