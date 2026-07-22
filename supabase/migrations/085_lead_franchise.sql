-- ============================================================
-- Migration 085 : rattachement d'un lead à une franchise
--
-- Un lead peut concerner un établissement franchisé. On mémorise la
-- franchise dès la création du lead pour qu'à la conversion en client,
-- l'établissement soit automatiquement classé dans son réseau
-- (clients.franchise_id existe déjà).
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS franchise_id uuid
  REFERENCES franchises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_franchise ON leads(franchise_id);
