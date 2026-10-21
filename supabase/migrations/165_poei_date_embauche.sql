-- ============================================================
-- 165 — Date d'embauche prévue du projet POEI
--
-- Réglée une fois dans les paramètres de la POEI, elle vaut pour chaque
-- candidat qui n'a pas sa propre date (poei_candidats.date_embauche_prevue,
-- qui l'emporte). Elle s'imprime sur le plan de développement de compétences
-- France Travail et sert au bilan de fin de formation ; sans elle, l'embauche
-- reste datée du lendemain de la fin de la POEI.
-- ============================================================

ALTER TABLE public.poei
  ADD COLUMN IF NOT EXISTS date_embauche_prevue date;

COMMENT ON COLUMN public.poei.date_embauche_prevue IS
  'Date d''embauche prévue pour les candidats du projet ; la date propre d''un candidat (poei_candidats.date_embauche_prevue) l''emporte.';

NOTIFY pgrst, 'reload schema';
