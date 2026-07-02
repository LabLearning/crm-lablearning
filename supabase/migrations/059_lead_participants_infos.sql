-- ============================================================
-- Migration 059 : Informations complètes des participants prévisionnels
-- (données nécessaires à l'inscription / convention / OPCO)
-- ============================================================

ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS date_naissance DATE;
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS type_contrat TEXT;
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS numero_securite_sociale TEXT;
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS niveau_diplome TEXT;
