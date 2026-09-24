-- ============================================================
-- 159 — Objectif mensuel de chiffre d'affaires
--
-- À côté de l'objectif d'établissements calés (migration 158), la direction
-- fixe un objectif de chiffre d'affaires HT par mois (60 000 € par défaut).
-- Colonne vide = objectif par défaut.
-- ============================================================

ALTER TABLE public.objectifs_formation
  ADD COLUMN IF NOT EXISTS ca_ht NUMERIC(12,2) CHECK (ca_ht IS NULL OR ca_ht > 0);

-- Fixer seulement l'objectif de CA ne doit pas figer celui des établissements :
-- une valeur vide veut dire « objectif par défaut » (25)
ALTER TABLE public.objectifs_formation ALTER COLUMN etablissements DROP NOT NULL;

COMMENT ON COLUMN public.objectifs_formation.ca_ht IS 'Objectif de chiffre d''affaires HT calé pour le mois (vide = objectif par défaut)';

NOTIFY pgrst, 'reload schema';
