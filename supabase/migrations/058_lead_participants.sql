-- ============================================================
-- Migration 058 : Participants prévisionnels d'un lead
-- Les employés du client saisis sur le lead, qui deviendront apprenants +
-- inscriptions dans la session au moment de la signature de la convention.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  civilite TEXT,
  prenom TEXT,
  nom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  poste TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_participants_lead ON lead_participants(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_participants_org ON lead_participants(organization_id);
