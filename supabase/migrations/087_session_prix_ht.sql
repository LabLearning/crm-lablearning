-- ============================================================
-- Migration 087 : prix de vente HT de la session
--
-- Montant facturé au client, saisi et modifiable à la création de la session,
-- repris comme montant HT de la convention. Distinct des coûts internes
-- (cout_formateur, cout_salle, cout_materiel). Jusqu'ici la convention prenait
-- le tarif brut de la formation sans possibilité d'ajuster par session.
-- ============================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS prix_ht numeric;

COMMENT ON COLUMN sessions.prix_ht IS
  'Prix de vente HT de la session, reporté sur la convention. Prime sur le tarif du catalogue.';
