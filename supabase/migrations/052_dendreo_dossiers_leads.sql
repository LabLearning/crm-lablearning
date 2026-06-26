-- ════════════════════════════════════════════════════════════════════
-- 052 — dendreo_id sur dossiers_formation et leads (financements + opportunités)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE dossiers_formation ADD COLUMN IF NOT EXISTS dendreo_id TEXT;
ALTER TABLE leads              ADD COLUMN IF NOT EXISTS dendreo_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dossiers_dendreo ON dossiers_formation (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_dendreo    ON leads              (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
