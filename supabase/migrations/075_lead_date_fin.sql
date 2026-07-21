-- ============================================================
-- Migration 075 : date de fin souhaitée sur les leads
--
-- Un lead ne portait qu'une date de début : impossible de savoir sur quelle
-- période le client devait se rendre disponible, ni de vérifier la
-- disponibilité d'un formateur avant de confirmer la session.
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_fin_souhaitee date;
ALTER TABLE lead_formations ADD COLUMN IF NOT EXISTS date_fin_souhaitee date;

COMMENT ON COLUMN lead_formations.date_fin_souhaitee IS
  'Fin de la période souhaitée. Pré-calculée depuis la durée de la formation, mais modifiable.';
