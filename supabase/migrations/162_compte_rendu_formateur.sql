-- ============================================================
-- 162 — Compte rendu de formation détaillé (rapport du formateur)
--
-- Le rapport de fin de session tenait en sept zones de texte libre. Il devient
-- un compte rendu structuré : déroulé par demi-journée (contenu et méthodes),
-- atteinte de chaque objectif de la formation, profil et participation du
-- groupe, modalités d'évaluation et acquis de chaque stagiaire, conditions de
-- réalisation, bilan et suites (besoins détectés).
--
-- Le détail est rangé dans une seule colonne JSON, versionnée ; une synthèse
-- en texte continue d'alimenter les colonnes existantes.
-- ============================================================

ALTER TABLE public.rapports_session
  ADD COLUMN IF NOT EXISTS compte_rendu jsonb;

COMMENT ON COLUMN public.rapports_session.compte_rendu IS
  'Compte rendu structuré (lib/compte-rendu.ts, version 1) : deroule, objectifs, groupe, evaluation, stagiaires, conditions, bilan.';

NOTIFY pgrst, 'reload schema';
