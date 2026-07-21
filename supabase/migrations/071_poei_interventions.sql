-- ============================================================
-- Migration 071 : interventions formateurs sur un projet POEI
-- Un POEI (140h–210h sur plusieurs semaines) peut être assuré par
-- plusieurs formateurs, chacun sur une période et un volume d'heures.
-- Chaque intervention suit le même circuit que les sessions :
-- proposition → acceptation par le formateur → contrat de prestation.
-- ============================================================

CREATE TABLE IF NOT EXISTS poei_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  poei_id uuid NOT NULL REFERENCES poei(id) ON DELETE CASCADE,
  formateur_id uuid REFERENCES formateurs(id) ON DELETE SET NULL,
  libelle text NOT NULL,                   -- « Semaine 1 — Hygiène & HACCP »
  date_debut date,
  date_fin date,
  nb_heures numeric,
  tarif_journalier numeric,
  montant_ht numeric,                      -- rémunération de l'intervention
  -- pending | accepted | refused | not_required
  mission_status text NOT NULL DEFAULT 'pending',
  mission_proposed_at timestamptz,
  mission_proposed_by uuid,
  mission_responded_at timestamptz,
  mission_response_comment text,
  ordre int NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poei_interventions_poei ON poei_interventions(poei_id);
CREATE INDEX IF NOT EXISTS idx_poei_interventions_formateur ON poei_interventions(formateur_id);
CREATE INDEX IF NOT EXISTS idx_poei_interventions_org ON poei_interventions(organization_id);

-- Le contrat de prestation peut désormais porter sur une intervention POEI
-- (et non plus obligatoirement sur une session de formation).
ALTER TABLE contrats_formateur ADD COLUMN IF NOT EXISTS poei_intervention_id uuid
  REFERENCES poei_interventions(id) ON DELETE CASCADE;
ALTER TABLE contrats_formateur ALTER COLUMN session_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contrats_formateur_intervention
  ON contrats_formateur(poei_intervention_id);

-- Garde-fou : un contrat porte soit sur une session, soit sur une intervention POEI
ALTER TABLE contrats_formateur DROP CONSTRAINT IF EXISTS contrats_formateur_cible_check;
ALTER TABLE contrats_formateur ADD CONSTRAINT contrats_formateur_cible_check
  CHECK (session_id IS NOT NULL OR poei_intervention_id IS NOT NULL);
