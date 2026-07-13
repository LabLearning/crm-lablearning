-- ============================================================
-- Migration 068 : pipeline "POEI à planifier" (pré-projets)
-- Suivi en amont : société, dates prévues, recrutement des
-- candidats, création du compte France Travail. Une fois prêt,
-- la prévision est transformée en vrai projet POEI (poei_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS poei_previsions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entreprise text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  date_ouverture_prevue date,
  date_debut_formation_prevue date,
  -- a_planifier | en_preparation | pret | transforme | abandonne
  statut text NOT NULL DEFAULT 'a_planifier',
  -- a_lancer | annonce_en_ligne | entretiens | candidats_trouves
  recrutement_statut text NOT NULL DEFAULT 'a_lancer',
  -- non_cree | en_cours | cree
  compte_ft_statut text NOT NULL DEFAULT 'non_cree',
  nb_candidats_prevus int,
  notes text,
  poei_id uuid REFERENCES poei(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poei_previsions_org ON poei_previsions(organization_id);
CREATE INDEX IF NOT EXISTS idx_poei_previsions_statut ON poei_previsions(organization_id, statut);
