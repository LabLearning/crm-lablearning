-- ============================================================
-- Migration 055 : Documents — upload de fichiers + envoi par email
-- ============================================================
-- - Lien direct vers un formateur (envoi de documents type "process formateur")
-- - Chemin de stockage du fichier (bucket privé "documents")
-- - Bucket de stockage dédié aux documents
-- ============================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS formateur_id UUID REFERENCES formateurs(id) ON DELETE SET NULL;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_formateur ON documents(formateur_id);

-- Bucket privé pour les documents uploadés (accès via service role / URLs signées)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
