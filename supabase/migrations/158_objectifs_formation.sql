-- ============================================================
-- 158 — Objectif mensuel d'établissements à former
--
-- Le tableau de bord affiche, pour le mois suivant, combien d'établissements
-- sont déjà calés en formation face à un objectif fixé par la direction
-- (25 par défaut). Une ligne par organisation et par mois : l'objectif peut
-- changer d'un mois à l'autre et l'historique reste lisible.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.objectifs_formation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Premier jour du mois visé (ex. 2026-10-01 pour octobre 2026)
  mois DATE NOT NULL CHECK (EXTRACT(DAY FROM mois) = 1),
  etablissements INTEGER NOT NULL CHECK (etablissements BETWEEN 1 AND 1000),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, mois)
);

-- Lecture et écriture par la clé de service uniquement, comme les autres
-- tables de pilotage (aucune politique : RLS ferme l'accès anonyme)
ALTER TABLE public.objectifs_formation ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.objectifs_formation IS 'Objectif d''établissements calés en formation, par organisation et par mois (tableau de bord)';

NOTIFY pgrst, 'reload schema';
