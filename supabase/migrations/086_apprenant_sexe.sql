-- ============================================================
-- Migration 086 : sexe de l'apprenant
--
-- Donnée d'état civil demandée dans les dossiers de prise en charge
-- (France Travail, OPCO), distincte de la civilité.
-- ============================================================

ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS sexe text
  CHECK (sexe IS NULL OR sexe IN ('H', 'F'));
