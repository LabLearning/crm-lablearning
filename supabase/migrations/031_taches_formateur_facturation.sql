-- ============================================================
-- 031 — Check-list tâches formateur + facturation automatique
-- ============================================================
-- 1. Table taches_formateur : liste des tâches à valider en fin de session
--    (compte-rendu, audit, satisfaction chaud, satisfaction froid, avis Google, etc.)
--    Quand toutes les tâches obligatoires (sauf "à froid") sont OK
--    → facturation formateur débloquée.
-- 2. Auto-création facture client à la mise_en_paiement OPCO.

CREATE TYPE tache_formateur_type AS ENUM (
  'compte_rendu',
  'plan_action',
  'audit_entree',
  'audit_sortie',
  'feuille_emargement',
  'satisfaction_chaud',
  'satisfaction_froid',
  'avis_google',
  'attestation_hygiene',
  'autre'
);

CREATE TABLE IF NOT EXISTS taches_formateur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  formateur_id UUID NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  type tache_formateur_type NOT NULL,
  libelle TEXT NOT NULL,
  description TEXT,
  ordre INTEGER DEFAULT 0,
  -- Bloque ou non la facturation
  bloque_facturation BOOLEAN DEFAULT TRUE,  -- 'satisfaction_froid' aura false (peut être validé après facturation)
  -- État
  complete BOOLEAN DEFAULT FALSE,
  date_completion TIMESTAMPTZ,
  fichier_url TEXT,
  fichier_filename TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taches_session ON taches_formateur(session_id);
CREATE INDEX IF NOT EXISTS idx_taches_formateur ON taches_formateur(formateur_id, complete);

CREATE TRIGGER tr_taches_formateur_updated_at
  BEFORE UPDATE ON taches_formateur
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Déblocage facturation formateur : flag + statut contrat
ALTER TABLE contrats_formateur
  ADD COLUMN IF NOT EXISTS facturation_debloquee_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facturation_status TEXT DEFAULT 'non_facturee'
  -- non_facturee / debloquee / facture_emise / payee
  ;

-- Index recherche rapide
CREATE INDEX IF NOT EXISTS idx_contrats_facturation ON contrats_formateur(organization_id, facturation_status);

-- ============================================================
-- Lien direct facture ↔ dossier_formation (déjà existant en fait)
-- ============================================================
-- factures.dossier_id existe déjà. On ajoute juste un index pour retrouver
-- vite la facture d'un dossier.
CREATE INDEX IF NOT EXISTS idx_factures_dossier ON factures(dossier_id) WHERE dossier_id IS NOT NULL;
