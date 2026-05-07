-- ============================================================
-- 024 — Workflow mission formateur (proposition → accept/refuse)
-- ============================================================
-- Quand le gestionnaire crée une session avec un formateur :
-- 1. Auto-check de la dispo via le calendrier Google + sessions existantes
-- 2. Notification au formateur (mission_status = 'pending')
-- 3. Le formateur accepte ou refuse depuis son espace
-- 4. Si refus → formateur_id retiré, mission_status = 'refused'

CREATE TYPE session_mission_status AS ENUM (
  'not_required',  -- Pas de formateur attribué (statut par défaut sans formateur)
  'pending',       -- Mission proposée, en attente de réponse du formateur
  'accepted',      -- Formateur a accepté
  'refused'        -- Formateur a refusé
);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS mission_status session_mission_status DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS mission_proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mission_proposed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mission_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mission_response_comment TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_mission_status ON sessions(organization_id, mission_status);
CREATE INDEX IF NOT EXISTS idx_sessions_mission_pending ON sessions(formateur_id, mission_status) WHERE mission_status = 'pending';

COMMENT ON COLUMN sessions.mission_status IS 'Statut de la mission proposée au formateur';
COMMENT ON COLUMN sessions.mission_proposed_at IS 'Date d''envoi de la proposition de mission';
COMMENT ON COLUMN sessions.mission_response_comment IS 'Motif du refus (si applicable)';
