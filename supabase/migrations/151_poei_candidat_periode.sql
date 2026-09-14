-- ============================================================
-- 151 — Période propre à chaque candidat POEI
--
-- Un parcours POEI ne démarre pas le même jour pour tout le monde : un
-- candidat recruté après le lancement intègre la formation en cours de
-- route, suit moins d'heures, et sa convention comme sa facture France
-- Travail doivent porter ses dates à lui, pas celles du projet.
-- Trois colonnes nullables : NULL = le candidat suit le calendrier du projet,
-- comme aujourd'hui. Rien ne change pour les dossiers existants.
-- ============================================================

ALTER TABLE poei_candidats
  ADD COLUMN IF NOT EXISTS date_debut date,
  ADD COLUMN IF NOT EXISTS date_fin date,
  ADD COLUMN IF NOT EXISTS duree_heures numeric;

COMMENT ON COLUMN poei_candidats.date_debut IS
  'Entrée en formation du candidat ; NULL = date de début du projet.';
COMMENT ON COLUMN poei_candidats.date_fin IS
  'Sortie de formation prévue ; NULL = date de fin du projet.';
COMMENT ON COLUMN poei_candidats.duree_heures IS
  'Heures suivies par ce candidat ; NULL = durée du projet. Un abandon déclaré (heures_effectuees) prime sur cette valeur.';

-- Une entrée décalée doit rester dans la période du projet : garde-fou simple,
-- la cohérence fine se lit dans l'interface.
ALTER TABLE poei_candidats
  DROP CONSTRAINT IF EXISTS poei_candidats_periode_coherente;
ALTER TABLE poei_candidats
  ADD CONSTRAINT poei_candidats_periode_coherente
  CHECK (date_debut IS NULL OR date_fin IS NULL OR date_fin >= date_debut);

NOTIFY pgrst, 'reload schema';
