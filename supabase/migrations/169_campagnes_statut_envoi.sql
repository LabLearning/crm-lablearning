-- ============================================================
-- 169 — Campagnes : statut « en_cours » des envois
--
-- La première version du fichier 168 a pu être appliquée avant l'ajout du
-- statut « en_cours » (envoi réservé par un passage de la tâche planifiée).
-- Sans lui, aucun envoi ne pourrait partir. Ce fichier repose la règle dans
-- tous les cas : sans effet si elle est déjà la bonne.
-- À coller d'un bloc dans l'éditeur SQL de Supabase.
-- ============================================================

ALTER TABLE public.campagne_envois DROP CONSTRAINT IF EXISTS campagne_envois_statut_check;
ALTER TABLE public.campagne_envois ADD CONSTRAINT campagne_envois_statut_check
  CHECK (statut IN ('a_envoyer', 'en_cours', 'envoye', 'echec', 'exclu'));

NOTIFY pgrst, 'reload schema';
