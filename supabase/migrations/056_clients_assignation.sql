-- ============================================================
-- Migration 056 : Assignation des clients (visibilité par utilisateur)
-- Un commercial ne voit que les clients qui lui sont assignés.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(assigned_to);

-- Backfill : les clients existants sont assignés à leur créateur
-- (évite qu'ils deviennent invisibles pour tout le monde du jour au lendemain)
UPDATE clients SET assigned_to = created_by
WHERE assigned_to IS NULL AND created_by IS NOT NULL;
