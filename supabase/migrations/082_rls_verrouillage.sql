-- ============================================================
-- Migration 082 : verrouillage RLS de toutes les tables publiques
--
-- URGENT. Une trentaine de tables n'avaient pas Row Level Security activé.
-- La clé « anon » étant publiée dans le navigateur de chaque visiteur,
-- n'importe qui pouvait interroger l'API REST directement et LIRE ces
-- tables — contrats formateurs et leurs signatures, factures, tâches,
-- rapports de session, api_keys — et même y ÉCRIRE.
--
-- Vérifié le 22/07/2026 : lecture confirmée sur 16 tables avec la seule
-- clé publique, et une insertion anonyme n'a été arrêtée que par une
-- contrainte de colonne, pas par une permission.
--
-- L'application n'est pas affectée : elle interroge Supabase avec la clé
-- de service (`createServiceRoleClient`), qui contourne RLS par
-- construction. Seule la table `notifications` est lue depuis le
-- navigateur, et elle possède déjà ses politiques.
--
-- Activer RLS sans politique = tout refuser sauf service_role.
-- ============================================================

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'          -- tables ordinaires uniquement
      AND c.relrowsecurity = false -- pas déjà protégées
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS activé sur %', t.relname;
  END LOOP;
END $$;

-- Vue exposée en SECURITY DEFINER : elle s'exécutait avec les droits de son
-- propriétaire et court-circuitait donc RLS. En security_invoker, elle
-- applique les droits de celui qui l'interroge.
ALTER VIEW IF EXISTS public.sessions_avec_stats SET (security_invoker = true);
