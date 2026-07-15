-- ============================================================
-- Migration 069 : avenants de convention (participants)
-- - conventions.participants_snapshot : liste des participants au
--   moment de l'envoi en signature (référence contractuelle)
-- - convention_avenants : chaque modification de participants après
--   envoi/signature génère un avenant numéroté
-- ============================================================

ALTER TABLE conventions ADD COLUMN IF NOT EXISTS participants_snapshot jsonb;

CREATE TABLE IF NOT EXISTS convention_avenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  numero int NOT NULL,                 -- Avenant n°1, n°2… par convention
  motif text,
  participants_avant jsonb,            -- liste complète avant
  participants_apres jsonb,            -- liste complète après
  ajoutes jsonb,                       -- participants ajoutés
  retires jsonb,                       -- participants retirés
  nombre_avant int,
  nombre_apres int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convention_avenants_conv ON convention_avenants(convention_id);
CREATE INDEX IF NOT EXISTS idx_convention_avenants_org ON convention_avenants(organization_id);
