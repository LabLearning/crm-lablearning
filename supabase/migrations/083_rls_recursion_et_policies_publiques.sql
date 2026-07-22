-- ============================================================
-- Migration 083 : récursion RLS sur users + politiques publiques dangereuses
--
-- Deux problèmes distincts, corrigés ensemble car liés.
--
-- 1) RÉCURSION INFINIE sur `users` (erreur 42P17)
--    Trois politiques vérifiaient l'appartenance à l'organisation par un
--    sous-SELECT sur `users` lui-même. Évaluer la politique de `users`
--    obligeait donc à relire `users`, qui redéclenchait la politique → boucle.
--    Symptôme : toute requête non-service_role touchant `users` échouait,
--    ce qui casse le temps réel des notifications et génère un flot d'erreurs
--    Postgres. Effet de bord : cette panne masquait la faille n°2.
--
-- 2) POLITIQUES « ouvertes à tout le monde » (USING true)
--    Quatre tables étaient lisibles par la clé anon (publiée dans le
--    navigateur) : portal_access_tokens (TOUS les jetons de portail, donc
--    accès sans mot de passe à tous les espaces), invitations, qcm_reponses,
--    signatures. Vérifié : AUCUN code navigateur ne lit ces tables — elles
--    ne sont interrogées que côté serveur, via la clé de service qui ignore
--    RLS. Ces politiques sont donc inutiles et purement dangereuses.
--
-- L'application n'est pas affectée : tout passe par createServiceRoleClient()
-- qui contourne RLS. On conserve seulement l'accès de chacun à sa PROPRE
-- ligne users (non récursif), utile à un éventuel accès authentifié direct.
-- ============================================================

-- ── 1. Récursion users : on supprime les trois politiques récursives ──
DROP POLICY IF EXISTS "Admin can manage users"     ON public.users;
DROP POLICY IF EXISTS "Users can view org members" ON public.users;
DROP POLICY IF EXISTS "users_read_org"             ON public.users;

-- Les politiques restantes (self-read / self-update) sont non récursives :
--   users_read_own      USING (id = auth.uid())
--   users_update_own    USING (id = auth.uid())
--   Users can update own profile
-- On les laisse en place.

-- ── 2. Politiques publiques inutiles et dangereuses ──
DROP POLICY IF EXISTS "public_portal_token_read"        ON public.portal_access_tokens;
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;
DROP POLICY IF EXISTS "public_qcm_by_token"             ON public.qcm_reponses;
DROP POLICY IF EXISTS "public_signature_by_token"       ON public.signatures;
