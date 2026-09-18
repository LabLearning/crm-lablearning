-- ============================================================
-- 155 — Journal d'activité : qui a fait quoi, quand, et pouvoir l'annuler
--
-- Chaque écriture sur les tables métier (création, modification,
-- suppression) est consignée par un déclencheur, avec l'état avant et après
-- la ligne, les colonnes touchées et l'utilisateur à l'origine. L'application
-- transmet cet utilisateur dans l'en-tête HTTP x-acteur-id (voir
-- lib/supabase/server.ts) ; sans en-tête, l'écriture est attribuée au
-- système (synchronisation Dendreo, scripts, tâches planifiées).
--
-- Règle d'or : le journal ne doit JAMAIS faire échouer l'écriture métier.
-- Toute erreur interne du déclencheur est avalée en avertissement.
--
-- Le journal applicatif audit_logs (mails envoyés, PDF, lectures de secrets)
-- reste en place : les deux se lisent ensemble sur /dashboard/activite.
-- ============================================================

CREATE TABLE IF NOT EXISTS activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- Qui : le compte qui agit (null = système), nom et email figés à l'écriture
  acteur_id uuid REFERENCES users(id) ON DELETE SET NULL,
  acteur_nom text,
  acteur_email text,
  -- Un super administrateur qui agit « en tant que » l'acteur
  impersone_par uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Quoi
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  libelle text,
  champs text[] NOT NULL DEFAULT '{}',
  avant jsonb,
  apres jsonb,
  -- Toutes les lignes d'une même transaction (une suppression et ses cascades)
  transaction_id bigint,
  -- Annulation : par qui, quand
  annulee_le timestamptz,
  annulee_par uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activites_org_date ON activites(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activites_acteur ON activites(acteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activites_impersone ON activites(impersone_par, created_at DESC) WHERE impersone_par IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activites_record ON activites(table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activites_transaction ON activites(transaction_id) WHERE transaction_id IS NOT NULL;

-- Service uniquement : le journal ne s'expose jamais derrière la clé publique
ALTER TABLE activites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE activites IS
  'Journal des écritures métier : acteur, table, ligne, état avant/après, colonnes touchées. Alimenté par déclencheur.';

-- ------------------------------------------------------------
-- Masquage : secrets, jetons, signatures, données sensibles ne sont jamais
-- recopiés. Motif sur le nom de colonne, plus garde-fou sur le contenu
-- (images et fichiers encodés en base64).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION journal_masquer(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN j IS NULL THEN NULL ELSE COALESCE((
    SELECT jsonb_object_agg(key,
      CASE
        WHEN jsonb_typeof(value) = 'null' THEN value
        WHEN key ~* '(token|secret|password|passwd|mot_de_passe|_chiffre$|signature_data|securite_sociale|iban|bic$|api_key|apikey|private_key)'
             AND key !~* '(_at|_le|_date|_expires.*|_count|_hint)$' THEN '"[masqué]"'::jsonb
        WHEN jsonb_typeof(value) = 'string' AND left(value #>> '{}', 5) = 'data:' THEN '"[masqué]"'::jsonb
        ELSE value
      END)
    FROM jsonb_each(j)), '{}'::jsonb) END
$$;

-- ------------------------------------------------------------
-- Déclencheur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION journal_activite() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hdr jsonb;
  acteur uuid;
  impersone uuid;
  act_nom text;
  act_email text;
  j_avant jsonb;
  j_apres jsonb;
  j_ref jsonb;
  cles text[] := '{}';
  k text;
  -- Colonnes qui bougent seules ou qui n'ont pas à figurer dans un journal lisible
  ignorees text[] := ARRAY['updated_at', 'created_at', 'last_login_at', 'last_login', 'derniere_connexion', 'last_sign_in_at', 'last_seen_at'];
  org uuid;
  lib text;
BEGIN
  BEGIN
    -- Qui écrit : en-têtes de la requête PostgREST
    BEGIN
      hdr := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
      hdr := NULL;
    END;
    IF hdr IS NOT NULL THEN
      BEGIN acteur := (hdr->>'x-acteur-id')::uuid; EXCEPTION WHEN OTHERS THEN acteur := NULL; END;
      BEGIN impersone := (hdr->>'x-acteur-impersone-par')::uuid; EXCEPTION WHEN OTHERS THEN impersone := NULL; END;
    END IF;
    -- Un acteur inconnu de la table users ferait échouer la clé étrangère : on garde sa trace en texte
    IF acteur IS NOT NULL THEN
      SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''), email
        INTO act_nom, act_email FROM users WHERE id = acteur;
      IF NOT FOUND THEN act_email := acteur::text; acteur := NULL; END IF;
    END IF;
    IF impersone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = impersone) THEN impersone := NULL; END IF;

    j_avant := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    j_apres := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    j_ref := COALESCE(j_apres, j_avant);

    -- Colonnes réellement modifiées
    IF TG_OP = 'UPDATE' THEN
      FOR k IN SELECT key FROM jsonb_each(j_apres) LOOP
        IF NOT (k = ANY(ignorees)) AND k NOT LIKE 'last_login%' AND (j_avant->k) IS DISTINCT FROM (j_apres->k) THEN
          cles := cles || k;
        END IF;
      END LOOP;
      -- Rien de visible n'a changé : pas de ligne
      IF array_length(cles, 1) IS NULL THEN RETURN NULL; END IF;
    END IF;

    j_avant := journal_masquer(j_avant);
    j_apres := journal_masquer(j_apres);

    BEGIN org := (j_ref->>'organization_id')::uuid; EXCEPTION WHEN OTHERS THEN org := NULL; END;
    -- Tables filles sans organisation (lignes de facture, de devis) : celle de l'acteur
    IF org IS NULL AND acteur IS NOT NULL THEN
      SELECT organization_id INTO org FROM users WHERE id = acteur;
    END IF;

    -- Libellé lisible de la ligne, selon ce que la table connaît
    lib := COALESCE(
      j_ref->>'numero', j_ref->>'reference', j_ref->>'raison_sociale', j_ref->>'intitule',
      NULLIF(TRIM(COALESCE(j_ref->>'prenom', '') || ' ' || COALESCE(j_ref->>'nom', '')), ''),
      j_ref->>'titre', j_ref->>'libelle', j_ref->>'designation', j_ref->>'file_name', j_ref->>'email'
    );

    INSERT INTO activites (organization_id, acteur_id, acteur_nom, acteur_email, impersone_par, table_name, record_id, operation, libelle, champs, avant, apres, transaction_id)
    VALUES (org, acteur, act_nom, act_email, impersone, TG_TABLE_NAME, (j_ref->>'id')::uuid, lower(TG_OP), lib, cles, j_avant, j_apres, pg_current_xact_id()::text::bigint);
  EXCEPTION WHEN OTHERS THEN
    -- Le journal ne bloque jamais le métier
    RAISE WARNING 'journal_activite % sur % : %', TG_OP, TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- Lignes qui référencent une fiche (toutes les clés étrangères entrantes) :
-- sert à refuser l'annulation d'une création qui emporterait des enfants.
CREATE OR REPLACE FUNCTION journal_dependances(p_table text, p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n bigint;
  res jsonb := '{}'::jsonb;
BEGIN
  IF to_regclass('public.' || quote_ident(p_table)) IS NULL THEN RETURN res; END IF;
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.confrelid = ('public.' || quote_ident(p_table))::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col) INTO n USING p_id;
    IF n > 0 THEN res := res || jsonb_build_object(replace(r.tbl, 'public.', ''), n); END IF;
  END LOOP;
  RETURN res;
END;
$$;
REVOKE ALL ON FUNCTION journal_dependances(text, uuid) FROM PUBLIC, anon, authenticated;

-- Tables journalisées : le cœur du métier et ses lignes filles, sans les
-- tables de mesure qui bougent en continu (émargements, pointages, mails).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'contacts', 'leads', 'apporteurs_affaires', 'apprenants', 'formateurs', 'formations',
    'sessions', 'inscriptions', 'session_formations', 'session_frais', 'contrats_formateur', 'rapports_session',
    'devis', 'devis_lignes', 'conventions', 'dossiers_formation', 'factures', 'facture_lignes', 'paiements',
    'poei', 'poei_candidats', 'poei_interventions', 'poei_plannings',
    'documents', 'users', 'franchises', 'commissions_sessions', 'evaluations_apprenant'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_journal_activite ON %I', t);
      EXECUTE format('CREATE TRIGGER tr_journal_activite AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION journal_activite()', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
