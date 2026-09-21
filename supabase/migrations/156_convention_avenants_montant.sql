-- ============================================================
-- 156 — Avenants de convention : prix et autres modifications
--
-- Les avenants ne portaient que sur les participants. Une convention signée
-- doit aussi pouvoir suivre un changement de prix, de durée ou de numéro de
-- prise en charge sans repartir de zéro : la modification est appliquée à
-- la convention, un avenant numéroté en garde la trace, et le PDF de la
-- convention mentionne l'avenant.
-- ============================================================

ALTER TABLE convention_avenants
  ADD COLUMN IF NOT EXISTS montant_avant numeric(12,2),
  ADD COLUMN IF NOT EXISTS montant_apres numeric(12,2),
  -- [{ champ, libelle, avant, apres }] pour les autres modifications
  ADD COLUMN IF NOT EXISTS changements jsonb;

COMMENT ON COLUMN convention_avenants.changements IS
  'Modifications hors participants : [{champ, libelle, avant, apres}] (durée, prise en charge, lieu…).';

NOTIFY pgrst, 'reload schema';
