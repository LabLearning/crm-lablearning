-- ============================================================
-- Migration 062 : N° de convention sur le candidat POEI
-- ============================================================

ALTER TABLE poei_candidats ADD COLUMN IF NOT EXISTS numero_convention TEXT;
