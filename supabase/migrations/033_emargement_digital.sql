-- ============================================================
-- 033 — Émargement numérique côté formateur
-- ============================================================
-- 1. Table emargement_feuilles : validation globale d'une feuille
--    (session × date × créneau) par le formateur, avec sa signature.
-- 2. Colonnes additionnelles sur emargements :
--    - motif_absence (raison de l'absence si est_present=false)
--    - signed_via (provenance : 'portail_formateur' / 'dashboard' / 'apprenant')
-- ============================================================

CREATE TABLE IF NOT EXISTS emargement_feuilles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  creneau TEXT NOT NULL CHECK (creneau IN ('matin','apres_midi','journee')),
  formateur_id UUID REFERENCES formateurs(id) ON DELETE SET NULL,
  formateur_signature_data TEXT,          -- base64 PNG de la signature du formateur
  validated_at TIMESTAMPTZ,                -- non-null = feuille verrouillée
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, date, creneau)
);

CREATE INDEX IF NOT EXISTS idx_feuilles_session ON emargement_feuilles(session_id);
CREATE INDEX IF NOT EXISTS idx_feuilles_validated ON emargement_feuilles(session_id, validated_at);

CREATE TRIGGER tr_feuilles_updated_at
  BEFORE UPDATE ON emargement_feuilles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Colonnes additionnelles sur emargements
ALTER TABLE emargements
  ADD COLUMN IF NOT EXISTS motif_absence TEXT,
  ADD COLUMN IF NOT EXISTS signed_via TEXT;
