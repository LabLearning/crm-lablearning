-- ============================================================
-- 047 — POEI collective : formations éligibles + candidats du projet
-- ============================================================
-- Une POEI devient un PROJET : 1 entreprise + 1 formation (POEI) + 1 session
-- + N candidats. Les candidats sont des apprenants (créés ou existants),
-- inscrits à la session du projet. poei_candidats porte les infos POEI
-- spécifiques par candidat (identifiant FT, poste, contrat, embauche).
-- ============================================================

-- Formations éligibles POEI (catalogue)
ALTER TABLE formations ADD COLUMN IF NOT EXISTS is_poei BOOLEAN DEFAULT false;

-- La POEI devient un projet (plusieurs candidats) : le candidat unique n'est
-- plus obligatoire au niveau projet.
ALTER TABLE poei ALTER COLUMN candidat_nom DROP NOT NULL;

-- Candidats d'un projet POEI
CREATE TABLE IF NOT EXISTS poei_candidats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  poei_id UUID NOT NULL REFERENCES poei(id) ON DELETE CASCADE,
  apprenant_id UUID REFERENCES apprenants(id) ON DELETE SET NULL,
  inscription_id UUID REFERENCES inscriptions(id) ON DELETE SET NULL,
  identifiant_ft TEXT,                 -- identifiant France Travail du candidat
  poste_vise TEXT,
  type_contrat TEXT,                   -- 'cdi' | 'cdd' | 'contrat_pro' | 'interim' | 'autre'
  date_embauche_prevue DATE,
  statut TEXT NOT NULL DEFAULT 'inscrit',  -- inscrit | en_formation | embauche | abandonne
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poei_candidats_poei ON poei_candidats(poei_id);
CREATE INDEX IF NOT EXISTS idx_poei_candidats_apprenant ON poei_candidats(apprenant_id);

ALTER TABLE poei_candidats ENABLE ROW LEVEL SECURITY;
