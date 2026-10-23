-- ============================================================
-- 166 — Frais d'une POEI déduits de la commission franchise
--
-- Demande de Brahim du 23/10/2026 : saisir les frais d'une POEI (transport,
-- logement, salle, formateur, autres) dans un onglet Frais, et qu'ils
-- comptent partout, d'abord dans la commission des franchises.
--
-- Les frais d'une POEI vont dans session_frais (migration 149), sur la
-- session qui porte le parcours : la rentabilité les compte déjà.
-- 1. Nouvelle catégorie « formateur » : un formateur payé en dehors des
--    contrats d'intervention (ceux-ci sont déjà comptés automatiquement).
-- 2. commissions_sessions.frais_annexes : les frais déduits, en mode
--    « budget net », du montant d'un parcours POEI, gardés à côté du coût
--    formateur pour que chaque commission s'explique.
-- À coller d'un bloc dans l'éditeur SQL de Supabase.
-- ============================================================

ALTER TABLE public.session_frais DROP CONSTRAINT IF EXISTS session_frais_categorie_check;
ALTER TABLE public.session_frais ADD CONSTRAINT session_frais_categorie_check CHECK (categorie IN
  ('deplacement','hebergement','repas','salle','materiel','supports','sous_traitance','formateur','autre'));

ALTER TABLE public.commissions_sessions
  ADD COLUMN IF NOT EXISTS frais_annexes numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.commissions_sessions.frais_annexes IS
  'Frais annexes du parcours POEI (session_frais) déduits du montant en mode budget net, en plus du coût formateur';

-- Rien n'est ouvert à anon ni à authenticated (migration 164) : on le redit
REVOKE ALL ON public.session_frais FROM anon, authenticated;
REVOKE ALL ON public.commissions_sessions FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
