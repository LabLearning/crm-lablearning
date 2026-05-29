-- 045_referent_handicap.sql
-- Référent handicap + délai d'accès : exigences Qualiopi (indicateurs 1 et accessibilité PSH).
-- Affichés sur le programme, la convocation, la convention, etc.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referent_handicap_nom text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referent_handicap_email text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referent_handicap_telephone text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS delai_acces text;
