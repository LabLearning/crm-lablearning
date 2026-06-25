-- ════════════════════════════════════════════════════════════════════
-- 049 — Intégration Dendreo : identifiants externes + journal webhooks
--
-- Objectif : synchroniser Dendreo → CRM de façon idempotente (un même
-- enregistrement Dendreo ne crée jamais de doublon), et tracer les
-- événements webhooks reçus. Le CRM reste maître ("fait foi à terme") :
-- l'import insère ou met à jour les champs sourcés Dendreo sans écraser
-- les saisies manuelles non concernées.
-- ════════════════════════════════════════════════════════════════════

-- 1) Identifiant Dendreo sur chaque entité synchronisée
ALTER TABLE clients            ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE contacts           ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE apprenants         ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE formateurs         ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE formations         ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE sessions           ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE factures           ADD COLUMN IF NOT EXISTS dendreo_id TEXT;

-- 2) Unicité par organisation (un id Dendreo = un enregistrement)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_dendreo     ON clients     (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_dendreo    ON contacts    (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_apprenants_dendreo  ON apprenants  (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_formateurs_dendreo  ON formateurs  (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_formations_dendreo  ON formations  (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_dendreo    ON sessions    (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_factures_dendreo    ON factures    (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;

-- 3) Journal des événements webhooks Dendreo (réception + debug + rejouabilité)
CREATE TABLE IF NOT EXISTS dendreo_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      TEXT,
  resource        TEXT,
  resource_id     TEXT,
  payload         JSONB,
  status          TEXT NOT NULL DEFAULT 'received', -- received | processed | error | ignored
  error           TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dendreo_events_received ON dendreo_webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_dendreo_events_resource ON dendreo_webhook_events (resource, resource_id);
