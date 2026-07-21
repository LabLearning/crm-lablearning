-- ============================================================
-- Migration 073 : archivage du contrat de prestation signé
-- Le PDF signé était re-généré à chaque téléchargement : une évolution
-- du gabarit réécrivait donc l'apparence d'un contrat déjà exécuté.
-- On fige désormais le PDF au moment de la signature (bucket `documents`)
-- et c'est cet exemplaire qui est servi ensuite.
-- ============================================================

ALTER TABLE contrats_formateur ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE contrats_formateur ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN contrats_formateur.storage_path IS
  'Chemin du PDF signé figé dans le bucket documents. Fait foi : le rendu à la volée n''est qu''un repli.';
