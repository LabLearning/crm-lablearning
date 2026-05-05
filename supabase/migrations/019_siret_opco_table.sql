-- ============================================================
-- 019 — Table de lookup direct SIRET → OPCO
-- Source: data.gouv table SIRET-OPCO (mars 2026)
-- ============================================================
-- Permet une détection 100% fiable de l'OPCO de n'importe quelle
-- entreprise française active, par simple lookup SIRET.
-- L'import des 3.5M lignes se fait via le script scripts/import-siret-opco.mjs.

CREATE TABLE siret_opco (
  siret TEXT PRIMARY KEY,
  opco_code TEXT NOT NULL,
  idcc TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pas d'index supplémentaire (PRIMARY KEY = index sur siret déjà optimal)

COMMENT ON TABLE siret_opco IS 'Lookup officiel SIRET → OPCO depuis data.gouv (mise à jour mars 2026)';
COMMENT ON COLUMN siret_opco.opco_code IS 'Code OPCO référencant la table opco (FK logique, pas de contrainte pour rapidité de l''import)';
