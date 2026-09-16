-- ============================================================
-- 152 — Positionnement à l'entrée d'un parcours POEI
--
-- France Travail finance un volume d'heures. Pour le justifier, il faut
-- montrer candidat par candidat l'écart entre son niveau d'entrée et le
-- référentiel de compétences du poste visé. Le candidat répond lui-même à
-- vingt questions, réparties sur les cinq domaines du métier d'équipier
-- polyvalent : sa note et le volume d'heures se déduisent de ses réponses.
--
-- Les réponses restent en JSON : le référentiel vit dans le code
-- (lib/poei-positionnement.ts), il évoluera plus vite qu'un schéma, et un
-- positionnement déjà réalisé doit garder la trace de ce qui a été répondu.
-- Les résultats calculés sont figés à l'enregistrement : un barème qui change
-- ne doit pas réécrire un document déjà transmis au financeur.
-- ============================================================

CREATE TABLE IF NOT EXISTS poei_positionnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  poei_id uuid NOT NULL REFERENCES poei(id) ON DELETE CASCADE,
  candidat_id uuid NOT NULL REFERENCES poei_candidats(id) ON DELETE CASCADE,

  -- Lien personnel envoyé au candidat, sans compte ni mot de passe
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- envoye : le candidat a reçu le lien · complete : il a répondu
  statut text NOT NULL DEFAULT 'envoye' CHECK (statut IN ('envoye', 'complete')),
  envoye_le timestamptz,
  complete_le timestamptz,

  -- Ce qui a été répondu : { code_question: index du choix retenu }
  reponses jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Ce qui en a été déduit, figé au moment de l'enregistrement
  resultats jsonb,
  note numeric(4,1),
  maitrise_globale numeric(5,1),
  heures_preconisees numeric(6,1),
  heures_referentiel numeric(6,1),
  niveau text,

  realise_le date,
  realise_par uuid REFERENCES users(id) ON DELETE SET NULL,
  commentaire text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Un positionnement d'entrée par candidat
  UNIQUE (candidat_id)
);

CREATE INDEX IF NOT EXISTS idx_poei_positionnements_poei ON poei_positionnements(poei_id);
CREATE INDEX IF NOT EXISTS idx_poei_positionnements_token ON poei_positionnements(token);

DROP TRIGGER IF EXISTS tr_poei_positionnements_updated_at ON poei_positionnements;
CREATE TRIGGER tr_poei_positionnements_updated_at
  BEFORE UPDATE ON poei_positionnements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sans politique : seule la clé de service y accède, comme les autres tables
-- POEI. Le niveau d'un candidat n'a rien à faire derrière la clé publique.
ALTER TABLE poei_positionnements ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE poei_positionnements IS
  'Positionnement d''entrée d''un candidat POEI : écart au référentiel et heures de formation justifiées.';
COMMENT ON COLUMN poei_positionnements.resultats IS
  'Résultats figés à l''enregistrement : un barème modifié ne réécrit pas un document déjà transmis.';

-- ------------------------------------------------------------
-- Rattrapage : une première version de cette migration créait la table pour
-- une grille remplie par le formateur. Le questionnaire est désormais rempli
-- par le candidat lui-même, d'où le lien personnel, le statut et la note.
-- ------------------------------------------------------------
ALTER TABLE poei_positionnements
  ADD COLUMN IF NOT EXISTS token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'envoye',
  ADD COLUMN IF NOT EXISTS envoye_le timestamptz,
  ADD COLUMN IF NOT EXISTS complete_le timestamptz,
  ADD COLUMN IF NOT EXISTS note numeric(4,1);

ALTER TABLE poei_positionnements ALTER COLUMN realise_le DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_poei_positionnements_token_unique ON poei_positionnements(token);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'poei_positionnements_statut_check'
  ) THEN
    ALTER TABLE poei_positionnements
      ADD CONSTRAINT poei_positionnements_statut_check CHECK (statut IN ('envoye', 'complete'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
