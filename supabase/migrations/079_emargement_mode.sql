-- ============================================================
-- Migration 079 : mode de signature d'une feuille d'émargement
--
-- Le formateur décide, feuille par feuille, entre la signature numérique
-- (chaque stagiaire signe sur son écran ou celui du formateur) et la
-- feuille papier (impression, signatures manuscrites, puis le formateur
-- pointe les présences et atteste de la feuille signée).
--
-- Le papier reste indispensable : salle sans réseau, groupe nombreux,
-- exigence d'un financeur.
-- ============================================================

ALTER TABLE emargement_feuilles ADD COLUMN IF NOT EXISTS mode text
  NOT NULL DEFAULT 'numerique'
  CHECK (mode IN ('numerique', 'papier'));

-- Feuille papier scannée et téléversée après la séance : c'est elle qui fait foi
ALTER TABLE emargement_feuilles ADD COLUMN IF NOT EXISTS scan_storage_path text;

COMMENT ON COLUMN emargement_feuilles.mode IS
  'numerique = signatures capturées à l''écran ; papier = feuille imprimée signée à la main, le formateur atteste et téléverse le scan.';
