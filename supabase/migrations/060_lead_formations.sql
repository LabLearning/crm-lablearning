-- ============================================================
-- Migration 060 : Un lead peut demander PLUSIEURS formations.
-- Chaque formation → sa propre session + sa propre convention.
-- Les participants sont un pool au niveau du lead, affectés par formation.
-- ============================================================

-- Une ligne = une formation demandée sur le lead
CREATE TABLE IF NOT EXISTS lead_formations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES formations(id) ON DELETE SET NULL,
  date_souhaitee DATE,
  date_confirmee DATE,
  formateur_id UUID REFERENCES formateurs(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  convention_id UUID REFERENCES conventions(id) ON DELETE SET NULL,
  planification_status TEXT DEFAULT 'a_planifier',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_formations_lead ON lead_formations(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_formations_session ON lead_formations(session_id);

-- Affectation des participants (pool) à une formation
CREATE TABLE IF NOT EXISTS lead_formation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_formation_id UUID NOT NULL REFERENCES lead_formations(id) ON DELETE CASCADE,
  lead_participant_id UUID NOT NULL REFERENCES lead_participants(id) ON DELETE CASCADE,
  UNIQUE (lead_formation_id, lead_participant_id)
);
CREATE INDEX IF NOT EXISTS idx_lfp_formation ON lead_formation_participants(lead_formation_id);

-- Migration des leads existants : une lead_formation depuis leads.formation_id
INSERT INTO lead_formations (organization_id, lead_id, formation_id, date_souhaitee, date_confirmee, formateur_id, session_id, planification_status)
SELECT organization_id, id, formation_id, date_souhaitee, date_confirmee, formateur_id, session_id, COALESCE(planification_status, 'a_planifier')
FROM leads
WHERE formation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM lead_formations lf WHERE lf.lead_id = leads.id AND lf.formation_id = leads.formation_id);
