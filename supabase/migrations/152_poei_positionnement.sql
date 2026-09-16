-- ============================================================
-- 152 — Positionnement à l'entrée d'un parcours POEI
--
-- France Travail finance un volume d'heures. Pour le justifier, il faut
-- montrer candidat par candidat l'écart entre son niveau d'entrée et le
-- référentiel de compétences du poste visé. Vingt situations de travail,
-- réparties sur les cinq domaines du métier d'équipier polyvalent, situent
-- le candidat et déduisent le volume d'heures dont il a besoin.
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

  -- Ce qui a été répondu : { code_question: 0..3 }
  reponses jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Ce qui en a été déduit, figé au moment de l'enregistrement
  resultats jsonb,
  maitrise_globale numeric(5,1),
  heures_preconisees numeric(6,1),
  heures_referentiel numeric(6,1),
  niveau text,

  realise_le date NOT NULL DEFAULT CURRENT_DATE,
  realise_par uuid REFERENCES users(id) ON DELETE SET NULL,
  commentaire text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Un positionnement d'entrée par candidat
  UNIQUE (candidat_id)
);

CREATE INDEX IF NOT EXISTS idx_poei_positionnements_poei ON poei_positionnements(poei_id);

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

NOTIFY pgrst, 'reload schema';
