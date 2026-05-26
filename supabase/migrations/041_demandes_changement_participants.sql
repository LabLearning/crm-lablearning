-- ============================================================
-- 041 — Demandes de changement de participants (formateur → gestionnaire)
-- ============================================================
-- Le jour J, le formateur peut déclarer un changement de stagiaire de
-- dernière minute (ajout / retrait / remplacement). Cela crée une demande
-- (ticket) que le gestionnaire valide ou refuse. Le formateur ne modifie
-- jamais directement les inscriptions (garde-fou Qualiopi).
-- ============================================================

CREATE TABLE IF NOT EXISTS demandes_changement_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  formateur_id UUID REFERENCES formateurs(id) ON DELETE SET NULL,
  type TEXT NOT NULL,                       -- 'ajout' | 'retrait' | 'remplacement'
  -- Participant concerné (retrait / remplacement) : apprenant déjà inscrit
  apprenant_id UUID REFERENCES apprenants(id) ON DELETE SET NULL,
  -- Nouveau participant (ajout / remplacement)
  nouveau_nom TEXT,
  nouveau_prenom TEXT,
  nouveau_email TEXT,
  nouveau_telephone TEXT,
  motif TEXT,
  statut TEXT NOT NULL DEFAULT 'en_attente',  -- 'en_attente' | 'validee' | 'refusee'
  -- Suivi
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,   -- null si déclaré via token portail
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  reponse_gestionnaire TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demandes_chg_org_statut ON demandes_changement_participants(organization_id, statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demandes_chg_session ON demandes_changement_participants(session_id);

CREATE TRIGGER tr_demandes_chg_updated_at
  BEFORE UPDATE ON demandes_changement_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
