-- ════════════════════════════════════════════════════════════════════
-- 053 — Reprise complète Dendreo : évaluations apprenants, salles,
--        et table de référence fourre-tout (zéro perte).
-- ════════════════════════════════════════════════════════════════════

-- 1) Évaluations individuelles des apprenants (notes /20 par formateur)
CREATE TABLE IF NOT EXISTS evaluations_apprenant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dendreo_id      TEXT,
  session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
  apprenant_id    UUID REFERENCES apprenants(id) ON DELETE CASCADE,
  formation_id    UUID REFERENCES formations(id) ON DELETE SET NULL,
  intitule        TEXT,
  note            NUMERIC(6,2),
  note_max        NUMERIC(6,2),
  appreciation    TEXT,
  evaluateur      TEXT,
  validated       BOOLEAN DEFAULT FALSE,
  date_evaluation TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_appr_dendreo ON evaluations_apprenant (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eval_appr_session ON evaluations_apprenant (session_id);
CREATE INDEX IF NOT EXISTS idx_eval_appr_apprenant ON evaluations_apprenant (apprenant_id);

-- 2) Salles de formation
CREATE TABLE IF NOT EXISTS salles_formation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dendreo_id       TEXT,
  intitule         TEXT NOT NULL,
  adresse          TEXT,
  code_postal      TEXT,
  ville            TEXT,
  capacite_max     INTEGER,
  telephone        TEXT,
  email            TEXT,
  acces_handicap   BOOLEAN,
  lien_google_maps TEXT,
  elearning        BOOLEAN,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_salles_dendreo ON salles_formation (organization_id, dendreo_id) WHERE dendreo_id IS NOT NULL;

-- 3) Référentiel fourre-tout Dendreo (sources, étapes, catégories, administrateurs…)
--    Garantit qu'aucune donnée Dendreo n'est perdue.
CREATE TABLE IF NOT EXISTS dendreo_reference (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ref_type        TEXT NOT NULL,
  dendreo_id      TEXT NOT NULL,
  label           TEXT,
  data            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dendreo_ref ON dendreo_reference (organization_id, ref_type, dendreo_id);
