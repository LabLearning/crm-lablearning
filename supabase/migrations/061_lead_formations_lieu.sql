-- ============================================================
-- Migration 061 : Lieu / adresse de la formation sur chaque formation demandée
-- ============================================================

ALTER TABLE lead_formations ADD COLUMN IF NOT EXISTS lieu TEXT;
