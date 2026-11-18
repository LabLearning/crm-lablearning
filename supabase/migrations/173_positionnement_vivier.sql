-- ============================================================
-- 173 — Questionnaire de positionnement envoyé depuis le vivier
--
-- Demande de Brahim du 18/11/2026 : le questionnaire part du vivier de
-- candidats, dès qu'un candidat est rattaché à un projet POEI, avant même
-- qu'il soit validé (apprenant créé, inscrit au projet). Un positionnement
-- peut donc appartenir à un candidat du vivier sans candidat de projet ;
-- à la validation, l'application relie les deux (candidat_id renseigné).
--
-- Suppression d'un candidat du vivier : l'application efface d'abord ses
-- positionnements non reliés à un candidat de projet, puis la clé passe à
-- NULL pour ceux qui le sont (ils restent sur la fiche du projet).
-- ============================================================

ALTER TABLE poei_positionnements ALTER COLUMN candidat_id DROP NOT NULL;

ALTER TABLE poei_positionnements
  ADD COLUMN IF NOT EXISTS vivier_candidat_id uuid REFERENCES candidats_vivier(id) ON DELETE SET NULL;

-- Un positionnement d'entrée par candidat du vivier
CREATE UNIQUE INDEX IF NOT EXISTS idx_poei_positionnements_vivier_unique
  ON poei_positionnements(vivier_candidat_id) WHERE vivier_candidat_id IS NOT NULL;

-- Toujours rattaché à quelqu'un : candidat du projet ou candidat du vivier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'poei_positionnements_cible_check'
  ) THEN
    ALTER TABLE poei_positionnements
      ADD CONSTRAINT poei_positionnements_cible_check
      CHECK (candidat_id IS NOT NULL OR vivier_candidat_id IS NOT NULL);
  END IF;
END $$;

-- Table toujours fermée à la clé publique (migration 164)
REVOKE ALL ON poei_positionnements FROM anon, authenticated;

COMMENT ON COLUMN poei_positionnements.vivier_candidat_id IS
  'Candidat du vivier à qui le questionnaire a été envoyé, avant sa validation ; candidat_id est renseigné à la validation.';

NOTIFY pgrst, 'reload schema';
