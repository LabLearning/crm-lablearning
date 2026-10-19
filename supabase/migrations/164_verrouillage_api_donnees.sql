-- ============================================================
-- Migration 164 : plus aucun accès direct aux données par l'API publique
--
-- Constat du 19/10/2026 (relecture des migrations 001 à 163 et du code) :
--
-- 1. AUTO-PROMOTION. Un compte connecté peut modifier sa propre ligne users
--    par l'API REST, colonne role comprise (politiques « Users can update own
--    profile » de 001 et users_update_own, sans WITH CHECK). Sont concernés
--    les formateurs, franchises et apporteurs, mais aussi n'importe qui :
--    l'inscription Supabase est ouverte et sans confirmation d'e-mail, et
--    handle_new_user (001) fait de chaque inscrit le super_admin d'un nouvel
--    organisme.
-- 2. CINQ TABLES SANS RLS, créées après 082 : la clé anon, publiée dans le
--    navigateur, les lit et les modifie (agences_france_travail,
--    limova_campagnes, limova_appels, formateur_evaluations,
--    appreciations_parties_prenantes).
-- 3. 61 POLITIQUES « membre de l'organisme » laissent tout compte de
--    l'organisme, quel que soit son rôle, lire et modifier 58 tables par
--    l'API : factures, apprenants (NIR), organizations (IBAN), jetons de
--    signature et de portail...
-- 4. DEUX POLITIQUES DE STOCKAGE sans clause TO (030 et 032) ouvrent à la clé
--    anon les buckets dossiers (accords OPCO) et organisation (tampon) :
--    liste, dépôt, remplacement, suppression.
-- 5. seed_default_permissions (SECURITY DEFINER) est appelable par la clé anon
--    via /rest/v1/rpc, comme les fonctions de chiffres (dashboard_kpis...).
--
-- Principe : l'application lit et écrit tout avec la clé de service
-- (createServiceRoleClient), que cette migration ne touche pas. Les rôles
-- anon et authenticated ne gardent que ce dont le navigateur a besoin : la
-- cloche de notifications (lire, marquer comme lu, supprimer ses
-- notifications, temps réel). Préalable déployé le 19/10 (b4687b5) : le
-- journal d'audit (logAudit) passe par la clé de service.
--
-- À coller d'un bloc dans l'éditeur SQL : le script forme alors une seule
-- transaction. La cloche y est essayée avec le rôle d'un compte connecté
-- avant la validation, et la moindre erreur annule tout.
-- Le contrôle final (dernière requête) doit répondre « conforme » partout.
--
-- Pour toute migration future : ENABLE ROW LEVEL SECURITY sur chaque table,
-- aucun GRANT à anon ou authenticated, aucune politique (la clé de service
-- n'en a pas besoin). Une table lue par le navigateur demande un GRANT et une
-- politique écrits pour elle.
-- ============================================================

-- Ne jamais figer le CRM : si une table est occupée, on abandonne (à recoller)
SET LOCAL lock_timeout = '5s';


-- ── 1. Politiques : une seule subsiste dans public, « chacun ses notifications » ──
-- Toutes les autres (dont les deux politiques d'auto-promotion sur users, les
-- 61 politiques « membre de l'organisme » et celles créées à la main hors
-- fichiers) ne servent qu'aux accès directs que l'on ferme : RLS reste
-- activée, donc sans politique tout est refusé hors clé de service.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'Politique non supprimée (droits insuffisants) : %.%', r.tablename, r.policyname;
    END;
  END LOOP;
END $$;

CREATE POLICY users_own_notifications ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── 2. RLS sur toutes les tables du schéma public (dont les cinq oubliées) ──
-- Sans effet pour l'application : la clé de service contourne RLS.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.t);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'RLS non activé (droits insuffisants) : %', r.t;
    END;
  END LOOP;
END $$;


-- ── 3. Tables et séquences : plus rien pour anon et authenticated ──
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- La clé de service garde tout (droits déjà présents, reposés par sécurité)
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- La cloche de notifications (components/layout/NotificationsBell.tsx,
-- app/dashboard/notifications/NotificationsClient.tsx) : lire ses
-- notifications et recevoir le temps réel, les marquer comme lues, les
-- supprimer. Plus d'ajout ni de modification du contenu.
GRANT SELECT, DELETE            ON public.notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON public.notifications TO authenticated;


-- ── 4. Fonctions appelables par /rest/v1/rpc : clé de service seulement ──
-- Hors fonctions d'extension (uuid_generate_v4, gen_random_bytes... servent
-- aux valeurs par défaut) et fonctions de déclencheur (jamais appelables par
-- l'API ; PostgreSQL ne contrôle pas EXECUTE quand un déclencheur se lance).
-- Les appels de l'application passent tous par la clé de service
-- (dashboard_kpis, manager_kpis, sessions_page_data, journal_dependances,
-- seed_qualiopi_indicateurs). supabase_auth_admin les garde, au cas où un
-- déclencheur sur auth.users ou un hook d'authentification en appellerait une.
DO $$
DECLARE
  r record;
  auth_admin boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin');
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS f
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC, anon, authenticated', r.f);
    EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO service_role', r.f);
    IF auth_admin THEN
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO supabase_auth_admin', r.f);
    END IF;
  END LOOP;
END $$;


-- ── 5. Les objets créés plus tard naissent fermés ──
-- Par défaut, Supabase ouvre chaque nouvelle table à anon et authenticated
-- (c'est ainsi que les cinq tables du point 2 se sont retrouvées publiques),
-- et PostgreSQL ouvre chaque nouvelle fonction à tous (PUBLIC). Le retrait
-- de PUBLIC sur les fonctions ne peut être que global (sans IN SCHEMA) : il
-- vaut pour les fonctions que postgres créera, les extensions activées depuis
-- le tableau de bord n'étant pas créées par postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres                  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Témoin : une table et une fonction créées maintenant doivent naître fermées
-- (résultat lu par le contrôle final ; les deux objets sont aussitôt supprimés)
DO $$
DECLARE
  table_ouverte boolean;
  fonction_ouverte boolean;
  service_ok boolean;
BEGIN
  CREATE TABLE public._temoin_164 (x int);
  CREATE FUNCTION public._temoin_164() RETURNS int LANGUAGE sql AS 'SELECT 1';
  table_ouverte := has_table_privilege('anon', 'public._temoin_164', 'SELECT, INSERT, UPDATE, DELETE')
                OR has_table_privilege('authenticated', 'public._temoin_164', 'SELECT, INSERT, UPDATE, DELETE');
  fonction_ouverte := has_function_privilege('anon', 'public._temoin_164()', 'EXECUTE')
                   OR has_function_privilege('authenticated', 'public._temoin_164()', 'EXECUTE');
  service_ok := has_table_privilege('service_role', 'public._temoin_164', 'SELECT, INSERT, UPDATE, DELETE')
            AND has_function_privilege('service_role', 'public._temoin_164()', 'EXECUTE');
  DROP FUNCTION public._temoin_164();
  DROP TABLE public._temoin_164;
  PERFORM set_config('lablearning.temoin_ouvert', ((table_ouverte OR fonction_ouverte)::int)::text, false);
  PERFORM set_config('lablearning.temoin_service', (service_ok::int)::text, false);
END $$;


-- ── 6. Stockage : les deux politiques « service_role » ouvertes à tous ──
-- La clé de service n'a besoin d'aucune politique (elle contourne RLS). Les
-- liens publics du bucket organisation (logo des e-mails) et les dépôts signés
-- (CV du site) ne passent pas par les politiques.
DO $$
BEGIN
  DROP POLICY IF EXISTS "dossiers_service_role_all"     ON storage.objects;
  DROP POLICY IF EXISTS "organisation_service_role_all" ON storage.objects;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Politiques de stockage non supprimées (droits insuffisants) : les retirer dans Storage > Policies';
END $$;


-- ── 7. Essai de la cloche avec le rôle d'un compte connecté ──
-- Sur la dernière notification en base, avec le rôle de son destinataire :
-- lecture (comme la cloche et le temps réel), marquer comme lu, supprimer.
-- L'essai est aussitôt défait (rien n'est modifié, aucun événement ne part),
-- mais les droits, la politique et les éventuels déclencheurs ont joué.
-- Un échec annule toute la migration.
DO $$
DECLARE
  uid uuid;
  nid uuid;
  n int := 0;
BEGIN
  SELECT user_id, id INTO uid, nid FROM public.notifications ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'Aucune notification en base : essai de la cloche sauté';
    RETURN;
  END IF;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.notifications;
    UPDATE public.notifications SET is_read = true, read_at = now() WHERE id = nid;
    DELETE FROM public.notifications WHERE id = nid;
    RAISE EXCEPTION 'essai_164';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'Migration annulée, rien n''a été changé : la cloche de notifications ne passerait plus (%)', SQLERRM;
    WHEN raise_exception THEN
      IF SQLERRM <> 'essai_164' THEN RAISE; END IF;
  END;
  IF n = 0 THEN
    RAISE EXCEPTION 'Migration annulée, rien n''a été changé : la cloche ne verrait plus les notifications de son compte';
  END IF;
END $$;


NOTIFY pgrst, 'reload schema';


-- ── Contrôle : la colonne « conforme » doit valoir true partout ──
-- La colonne « objets » nomme ce qui reste à traiter ; me la transmettre si
-- une ligne n'est pas conforme.
WITH
tabs AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
),
fonctions AS (
  SELECT p.oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
),
lignes AS (
  SELECT 1 AS ordre, 'Tables accessibles à la clé anon' AS controle,
         count(*)::int AS valeur, 0 AS attendu, string_agg(relname, ', ') AS objets
  FROM tabs
  WHERE has_any_column_privilege('anon', oid, 'SELECT, INSERT, UPDATE')
     OR has_table_privilege('anon', oid, 'DELETE, TRUNCATE')
  UNION ALL
  SELECT 2, 'Tables accessibles à un compte connecté, hors notifications',
         count(*)::int, 0, string_agg(relname, ', ')
  FROM tabs
  WHERE relname <> 'notifications'
    AND (has_any_column_privilege('authenticated', oid, 'SELECT, INSERT, UPDATE')
         OR has_table_privilege('authenticated', oid, 'DELETE, TRUNCATE'))
  UNION ALL
  SELECT 3, 'Tables sans RLS', count(*)::int, 0, string_agg(relname, ', ')
  FROM tabs WHERE relkind IN ('r', 'p') AND NOT relrowsecurity
  UNION ALL
  SELECT 4, 'Fonctions appelables par anon ou un compte connecté', count(*)::int, 0, string_agg(oid::regprocedure::text, ', ')
  FROM fonctions
  WHERE has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE')
  UNION ALL
  SELECT 5, 'Politiques dans public, hors « chacun ses notifications »', count(*)::int, 0, string_agg(tablename || '.' || policyname, ', ')
  FROM pg_policies
  WHERE schemaname = 'public' AND NOT (tablename = 'notifications' AND policyname = 'users_own_notifications')
  UNION ALL
  SELECT 6, 'Stockage : les deux politiques ouvertes à tous', count(*)::int, 0, string_agg(policyname, ', ')
  FROM pg_policies
  WHERE schemaname = 'storage' AND policyname IN ('dossiers_service_role_all', 'organisation_service_role_all')
  UNION ALL
  SELECT 7, 'Stockage : autres politiques pour anon ou comptes connectés (à me transmettre)', count(*)::int, 0,
         string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', ')
  FROM pg_policies
  WHERE schemaname = 'storage' AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    AND policyname NOT IN ('dossiers_service_role_all', 'organisation_service_role_all')
  UNION ALL
  SELECT 8, 'Notifications : lecture par un compte connecté',
         has_table_privilege('authenticated', 'public.notifications', 'SELECT')::int, 1, NULL
  UNION ALL
  SELECT 9, 'Notifications : ajout ou réécriture du contenu par un compte connecté',
         (has_table_privilege('authenticated', 'public.notifications', 'INSERT')
          OR has_column_privilege('authenticated', 'public.notifications', 'titre', 'UPDATE'))::int, 0, NULL
  UNION ALL
  SELECT 10, 'Objets créés désormais : ouverts à anon ou aux comptes connectés',
         coalesce(nullif(current_setting('lablearning.temoin_ouvert', true), ''), '1')::int, 0, NULL
  UNION ALL
  SELECT 11, 'Objets créés désormais : utilisables par la clé de service',
         coalesce(nullif(current_setting('lablearning.temoin_service', true), ''), '0')::int, 1, NULL
  UNION ALL
  SELECT 12, 'Clé de service : lecture des comptes et appel de dashboard_kpis',
         (has_table_privilege('service_role', 'public.users', 'SELECT, INSERT, UPDATE, DELETE')
          AND coalesce((SELECT bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE'))
                        FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'dashboard_kpis'), true))::int, 1, NULL
  UNION ALL
  SELECT 13, 'Réglage db_pre_request de PostgREST (à me transmettre)', count(*)::int, 0, string_agg(cfg, ', ')
  FROM pg_db_role_setting s, unnest(s.setconfig) cfg
  WHERE cfg LIKE 'pgrst.db_pre_request=%'
  UNION ALL
  SELECT 14, 'Extensions installées dans public (pour information)', count(*)::int, NULL, string_agg(extname, ', ')
  FROM pg_extension WHERE extnamespace = 'public'::regnamespace
)
SELECT controle, valeur, attendu, (valeur = attendu) AS conforme, objets
FROM lignes
ORDER BY ordre;
