-- ============================================================
-- Migration 084 : espace documentaire type « drive » pour la section POEI
--
-- Dossiers hiérarchiques (sous-dossiers à volonté) organisés par société.
-- Les fichiers réutilisent la table `documents` et le bucket privé
-- `documents` (déjà servi par URL signée), via une nouvelle colonne de
-- rattachement au dossier du drive.
-- ============================================================

CREATE TABLE IF NOT EXISTS documentation_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Sous-dossiers : un dossier racine a parent_id NULL
  parent_id uuid REFERENCES documentation_dossiers(id) ON DELETE CASCADE,
  nom text NOT NULL,
  -- Lien optionnel vers un client du CRM (dossier « société »)
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_dossiers_org ON documentation_dossiers(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_dossiers_parent ON documentation_dossiers(parent_id);

-- Rattachement d'un document à un dossier du drive
ALTER TABLE documents ADD COLUMN IF NOT EXISTS documentation_dossier_id uuid
  REFERENCES documentation_dossiers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_documents_doc_dossier ON documents(documentation_dossier_id);

-- RLS activé sans politique publique : accès réservé au service role (l'app).
-- Cohérent avec le durcissement des migrations 082/083.
ALTER TABLE documentation_dossiers ENABLE ROW LEVEL SECURITY;
