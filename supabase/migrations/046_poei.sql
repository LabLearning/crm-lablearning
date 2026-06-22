-- ============================================================
-- 046 — POEI (Préparation Opérationnelle à l'Emploi Individuelle)
-- ============================================================
-- Dispositif France Travail : un demandeur d'emploi (candidat) est formé
-- pour occuper un poste chez un employeur qui s'engage à l'embaucher.
-- Relie : candidat ↔ employeur (client) ↔ formation/session ↔ financement
-- France Travail ↔ engagement d'embauche. Pipeline propre.
-- ============================================================

CREATE TABLE IF NOT EXISTS poei (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  numero TEXT,

  -- Candidat (demandeur d'emploi)
  candidat_civilite TEXT,
  candidat_nom TEXT NOT NULL,
  candidat_prenom TEXT,
  candidat_email TEXT,
  candidat_telephone TEXT,
  candidat_identifiant_ft TEXT,                 -- identifiant France Travail
  apprenant_id UUID REFERENCES apprenants(id) ON DELETE SET NULL,  -- lien quand il devient apprenant

  -- Employeur + poste
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  poste_vise TEXT,
  type_contrat TEXT,                            -- 'cdi' | 'cdd' | 'contrat_pro' | 'interim' | 'autre'
  date_embauche_prevue DATE,
  tuteur_nom TEXT,

  -- Formation
  formation_id UUID REFERENCES formations(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  duree_heures NUMERIC,                          -- POEI plafonnée à 400 h
  date_debut DATE,
  date_fin DATE,

  -- Financement France Travail
  montant_horaire NUMERIC,                       -- taux horaire France Travail
  montant_total NUMERIC,
  numero_dossier_ft TEXT,                        -- n° dossier France Travail
  date_depot_ft DATE,
  date_accord_ft DATE,

  -- Pipeline
  statut TEXT NOT NULL DEFAULT 'prospect',
  -- prospect | candidature | montage | depose | accorde | en_formation
  -- | terminee | embauche | refuse | abandonne
  notes TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poei_org_statut ON poei(organization_id, statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poei_client ON poei(client_id);
CREATE INDEX IF NOT EXISTS idx_poei_formation ON poei(formation_id);

ALTER TABLE poei ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tr_poei_updated_at
  BEFORE UPDATE ON poei
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
