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
-- Le journal applicatif audit_logs (mails envoyés, PDF, lectures de secrets)
-- reste en place : les deux se lisent ensemble sur /dashboard/activite.
-- ============================================================

CREATE TABLE IF NOT EXISTS activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- Qui : l'utilisateur connecté (null = système)
  acteur_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Un super administrateur qui agit « en tant que » quelqu'un d'autre
  impersone_par uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Quoi
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  libelle text,
  champs text[] NOT NULL DEFAULT '{}',
  avant jsonb,
  apres jsonb,
  -- Annulation : par qui, quand, et l'activité d'annulation elle-même
  annulee_le timestamptz,
  annulee_par uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activites_org_date ON activites(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activites_acteur ON activites(acteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activites_record ON activites(table_name, record_id, created_at DESC);

-- Service uniquement : le journal ne s'expose jamais derrière la clé publique
ALTER TABLE activites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE activites IS
  'Journal des écritures métier : acteur, table, ligne, état avant/après, colonnes touchées. Alimenté par déclencheur.';

-- ------------------------------------------------------------
-- Déclencheur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION journal_activite() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hdr jsonb;
  acteur uuid;
  impersone uuid;
  j_avant jsonb;
  j_apres jsonb;
  j_ref jsonb;
  cles text[] := '{}';
  k text;
  -- Colonnes qui bougent seules ou qui n'ont pas à figurer dans un journal lisible
  ignorees text[] := ARRAY['updated_at', 'created_at', 'last_login', 'derniere_connexion', 'last_sign_in_at'];
  -- Colonnes dont le contenu ne doit jamais être recopié (secrets, signatures, blobs)
  masquees text[] := ARRAY['opco_compte_chiffre', 'signature_data', 'password', 'password_hash', 'token', 'signature_token', 'access_token', 'refresh_token'];
  org uuid;
  lib text;
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

  IF TG_OP = 'DELETE' THEN j_avant := to_jsonb(OLD); ELSE j_avant := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END; END IF;
  IF TG_OP = 'DELETE' THEN j_apres := NULL; ELSE j_apres := to_jsonb(NEW); END IF;
  j_ref := COALESCE(j_apres, j_avant);

  -- Colonnes réellement modifiées
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each(j_apres) LOOP
      IF NOT (k = ANY(ignorees)) AND (j_avant->k) IS DISTINCT FROM (j_apres->k) THEN
        cles := cles || k;
      END IF;
    END LOOP;
    -- Rien de visible n'a changé : pas de ligne
    IF array_length(cles, 1) IS NULL THEN RETURN NULL; END IF;
  END IF;

  -- Secrets et blobs remplacés par une marque
  FOREACH k IN ARRAY masquees LOOP
    IF j_avant ? k AND j_avant->>k IS NOT NULL THEN j_avant := jsonb_set(j_avant, ARRAY[k], '"[masqué]"'::jsonb); END IF;
    IF j_apres ? k AND j_apres->>k IS NOT NULL THEN j_apres := jsonb_set(j_apres, ARRAY[k], '"[masqué]"'::jsonb); END IF;
  END LOOP;

  BEGIN org := (j_ref->>'organization_id')::uuid; EXCEPTION WHEN OTHERS THEN org := NULL; END;

  -- Libellé lisible de la ligne, selon ce que la table connaît
  lib := COALESCE(
    j_ref->>'numero', j_ref->>'reference', j_ref->>'raison_sociale', j_ref->>'intitule',
    NULLIF(TRIM(COALESCE(j_ref->>'prenom', '') || ' ' || COALESCE(j_ref->>'nom', '')), ''),
    j_ref->>'titre', j_ref->>'libelle', j_ref->>'file_name', j_ref->>'email'
  );

  INSERT INTO activites (organization_id, acteur_id, impersone_par, table_name, record_id, operation, libelle, champs, avant, apres)
  VALUES (org, acteur, impersone, TG_TABLE_NAME, (j_ref->>'id')::uuid, lower(TG_OP), lib, cles, j_avant, j_apres);
  RETURN NULL;
END;
$$;

-- Tables journalisées : le cœur du métier, sans les tables de mesure qui
-- bougent en continu (émargements, pointages, logs de mails).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'contacts', 'leads', 'apporteurs_affaires', 'apprenants', 'formateurs', 'formations',
    'sessions', 'inscriptions', 'session_frais', 'contrats_formateur', 'rapports_session',
    'devis', 'conventions', 'dossiers_formation', 'factures', 'paiements',
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
