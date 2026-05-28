-- 043 — Suivi des relances de factures (cron relances-factures)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS derniere_relance_at TIMESTAMPTZ;
