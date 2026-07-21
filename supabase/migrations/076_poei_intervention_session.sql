-- ============================================================
-- Migration 076 : une session par intervention POEI
--
-- Émargements, questionnaires et documents sont tous rattachés à une
-- session. Une intervention POEI n'en ayant pas, le formateur qui
-- n'assurait qu'une partie du parcours n'avait accès à rien : ni feuille
-- d'émargement, ni questionnaire d'entrée, ni liste de stagiaires.
--
-- Chaque intervention porte désormais sa propre session, sur ses dates et
-- avec son formateur. La session « parcours » du POEI reste le chapeau
-- administratif (convention, financement).
-- ============================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS poei_intervention_id uuid
  REFERENCES poei_interventions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sessions_poei_intervention
  ON sessions(poei_intervention_id);

COMMENT ON COLUMN sessions.poei_intervention_id IS
  'Session d''intervention POEI : sous-période animée par un formateur. La session chapeau du parcours est référencée par poei.session_id.';
