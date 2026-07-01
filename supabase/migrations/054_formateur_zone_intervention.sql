-- ============================================================
-- Migration 054 : Zone d'intervention du formateur
-- Zone géographique où le formateur peut se déplacer / intervenir
-- (texte libre : "Île-de-France", "National", "Grand Est + Bourgogne"...)
-- ============================================================

ALTER TABLE formateurs
  ADD COLUMN IF NOT EXISTS zone_intervention TEXT;
