-- ============================================================
-- Migration 081 : émargement papier au niveau de la session
--
-- Le mode papier avait été posé feuille par feuille (une par jour et par
-- créneau), ce qui n'a pas de sens : le formateur imprime UNE feuille
-- couvrant toute la session, la fait signer au fil des jours, puis la
-- scanne une fois à la fin.
--
-- Le mode par feuille (migration 079) reste utile pour le numérique, où
-- chaque demi-journée est validée séparément.
-- ============================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS emargement_mode text
  NOT NULL DEFAULT 'numerique'
  CHECK (emargement_mode IN ('numerique', 'papier'));

-- Scan de la feuille signée : c'est la pièce qui fait foi en cas de contrôle
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS emargement_scan_path text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS emargement_scan_uploaded_at timestamptz;

COMMENT ON COLUMN sessions.emargement_mode IS
  'numerique = chaque demi-journée signée à l''écran ; papier = feuille unique imprimée pour toute la session, signée à la main puis scannée.';
