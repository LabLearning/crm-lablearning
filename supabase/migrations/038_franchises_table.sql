-- ============================================================
-- 038 — Table franchises dédiée (détachée des apporteurs d'affaires)
-- ============================================================
-- Une franchise est désormais une entité propre (réseau franchisé que
-- Lab Learning forme), distincte d'un apporteur d'affaires.
--
-- Hiérarchie : Franchise → Établissements (clients.franchise_id) → Dossiers.
-- Le franchiseur est un user (role='franchise', users.franchise_id).
--
-- Aucune franchise en base actuellement → migration sans perte de données.
-- On re-pointe simplement les FK franchise_id vers la nouvelle table.
-- ============================================================

CREATE TABLE IF NOT EXISTS franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Identité
  nom TEXT NOT NULL,                       -- nom de l'enseigne (ex: "Brioche Dorée")
  raison_sociale TEXT,
  siret TEXT,
  secteur TEXT,                            -- HCR, Boulangerie, Boucherie...
  nombre_etablissements INTEGER,           -- points de vente déclarés
  zone_geographique TEXT,
  -- Contact référent
  contact_nom TEXT,
  contact_email TEXT,
  contact_telephone TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  -- Objectifs
  objectif_annuel_ca NUMERIC(12,2),
  objectif_annuel_dossiers INTEGER,
  -- Commission (mode au niveau franchise)
  commission_type TEXT DEFAULT 'budget_debloque',  -- 'budget_debloque' | 'budget_net'
  taux_commission NUMERIC(5,2) DEFAULT 10,
  -- Divers
  logo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_franchises_org ON franchises(organization_id, is_active);

CREATE TRIGGER tr_franchises_updated_at
  BEFORE UPDATE ON franchises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Re-pointer les FK franchise_id vers la table franchises
-- (les colonnes existent déjà, créées en migration 036)
-- ============================================================
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_franchise_id_fkey;
ALTER TABLE clients ADD CONSTRAINT clients_franchise_id_fkey
  FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE SET NULL;

ALTER TABLE dossiers_formation DROP CONSTRAINT IF EXISTS dossiers_formation_franchise_id_fkey;
ALTER TABLE dossiers_formation ADD CONSTRAINT dossiers_formation_franchise_id_fkey
  FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_franchise_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_franchise_id_fkey
  FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE SET NULL;

ALTER TABLE audits_etablissement DROP CONSTRAINT IF EXISTS audits_etablissement_franchise_id_fkey;
ALTER TABLE audits_etablissement ADD CONSTRAINT audits_etablissement_franchise_id_fkey
  FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE SET NULL;
