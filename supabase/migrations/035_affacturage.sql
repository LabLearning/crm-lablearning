-- ============================================================
-- 035 — Affacturage (factoring)
-- ============================================================
-- Permet de céder une facture à un factor pour obtenir le cash
-- sans attendre le paiement OPCO (30-60j).
--
-- Workflow :
--   1. Facture émise → bouton "Céder à l'affacturage" → cession créée
--      avec status 'en_attente_avance'
--   2. Factor verse l'avance (80-95% du TTC) → status 'avancee'
--      + date_avance + montant_avance
--   3. OPCO paie le factor à échéance → cession 'soldee'
--      (propagé auto quand la facture passe 'payee')
--   4. Si OPCO ne paye pas dans les délais → 'impayee' (recours)
-- ============================================================

CREATE TABLE IF NOT EXISTS affactureurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  raison_sociale TEXT NOT NULL,
  siret TEXT,
  contact_nom TEXT,
  contact_email TEXT,
  contact_telephone TEXT,
  -- Conditions par défaut
  taux_commission_default NUMERIC(5,2) DEFAULT 1.50,    -- ex: 1.50%
  taux_retenue_default NUMERIC(5,2) DEFAULT 10.00,      -- ex: 10% de garantie
  delai_avance_jours INTEGER DEFAULT 2,                  -- délai en jours pour recevoir l'avance
  plafond_encours NUMERIC(12,2),                          -- plafond max d'encours total
  contrat_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affactureurs_org ON affactureurs(organization_id, is_active);

CREATE TRIGGER tr_affactureurs_updated_at
  BEFORE UPDATE ON affactureurs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Statut d'une cession
-- ============================================================
CREATE TYPE cession_status AS ENUM (
  'en_attente_avance',  -- cédée, en attente du versement factor
  'avancee',             -- factor a versé l'avance
  'soldee',              -- OPCO/client a payé le factor → tout est OK
  'impayee',             -- OPCO n'a pas payé dans les délais
  'annulee'              -- cession annulée avant avance
);

CREATE TABLE IF NOT EXISTS cessions_creances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  affactureur_id UUID NOT NULL REFERENCES affactureurs(id) ON DELETE RESTRICT,
  -- Numéro interne (auto-incrémenté plus tard)
  reference TEXT,
  reference_factor TEXT,
  -- Montants
  montant_cede NUMERIC(12,2) NOT NULL,        -- TTC cédé (souvent = facture.montant_ttc)
  taux_commission NUMERIC(5,2) NOT NULL,      -- % pris par le factor
  montant_commission NUMERIC(12,2) NOT NULL,  -- calculé
  taux_retenue NUMERIC(5,2) DEFAULT 0,        -- % de retenue de garantie
  montant_retenue NUMERIC(12,2) DEFAULT 0,    -- calculé
  montant_avance NUMERIC(12,2) NOT NULL,      -- cédé - commission - retenue
  -- Dates
  date_cession DATE NOT NULL DEFAULT CURRENT_DATE,
  date_avance DATE,                            -- quand le factor a versé
  date_soldee DATE,                            -- quand OPCO a payé le factor
  -- Statut
  status cession_status NOT NULL DEFAULT 'en_attente_avance',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cessions_facture_active
  ON cessions_creances(facture_id)
  WHERE status NOT IN ('annulee', 'soldee', 'impayee');

CREATE INDEX IF NOT EXISTS idx_cessions_org_status ON cessions_creances(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cessions_factor ON cessions_creances(affactureur_id, status);

CREATE TRIGGER tr_cessions_updated_at
  BEFORE UPDATE ON cessions_creances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Flag rapide sur la facture pour filtrer/afficher
-- ============================================================
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS affacturage_status TEXT;  -- null / 'cedee' / 'avancee' / 'soldee' / 'impayee'
