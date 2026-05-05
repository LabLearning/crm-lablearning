-- ============================================================
-- 022 — Workflow de validation Lead (commercial → DC → gestionnaire)
-- ============================================================
-- Implémente le parcours métier décrit par Lab Learning :
-- 1. Le commercial / apporteur / responsable saisit un lead (draft)
-- 2. Il le soumet au directeur commercial (pending)
-- 3. Le directeur commercial valide (approved) ou refuse (rejected)
-- 4. À la validation, le directeur assigne un gestionnaire de dossier
-- 5. Le gestionnaire reçoit la fiche dans "Mes dossiers à traiter"

CREATE TYPE lead_validation_status AS ENUM (
  'draft',     -- En cours de saisie par le commercial
  'pending',   -- Soumis au directeur commercial pour validation
  'approved',  -- Validé par le directeur, en cours de traitement par un gestionnaire
  'rejected'   -- Refusé par le directeur
);

ALTER TABLE leads
  ADD COLUMN validation_status lead_validation_status DEFAULT 'draft',
  ADD COLUMN submitted_at TIMESTAMPTZ,
  ADD COLUMN submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN validated_at TIMESTAMPTZ,
  ADD COLUMN validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN validation_comment TEXT,
  ADD COLUMN gestionnaire_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_validation ON leads(organization_id, validation_status);
CREATE INDEX idx_leads_gestionnaire ON leads(gestionnaire_id);
CREATE INDEX idx_leads_submitted_by ON leads(submitted_by);

COMMENT ON COLUMN leads.validation_status IS 'Étape du workflow de validation (draft / pending / approved / rejected)';
COMMENT ON COLUMN leads.gestionnaire_id IS 'Utilisateur (rôle gestionnaire) en charge du dossier après validation';
COMMENT ON COLUMN leads.validation_comment IS 'Commentaire du directeur commercial à la validation ou au refus';
