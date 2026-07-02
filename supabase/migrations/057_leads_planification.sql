-- ============================================================
-- Migration 057 : Planification des leads (workflow commercial)
-- Formation liée (FK), formateur désigné, date confirmée, session créée,
-- et statut de planification (À planifier / Date confirmée / Autre date proposée).
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS formation_id UUID REFERENCES formations(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS formateur_id UUID REFERENCES formateurs(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_confirmee DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS planification_status TEXT DEFAULT 'a_planifier';

CREATE INDEX IF NOT EXISTS idx_leads_formation ON leads(formation_id);
CREATE INDEX IF NOT EXISTS idx_leads_session ON leads(session_id);
