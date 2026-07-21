-- ============================================================
-- Migration 080 : Contenu pédagogique d'une session
-- ============================================================
-- - Visibilité d'un document : formateur seul / + stagiaires / tout le monde
--   (le client entreprise ne voit que les documents en 'tous')
-- - Déroulé pédagogique + matériel nécessaire portés par la session
-- - Nouveaux types de documents pour les supports de cours
-- ============================================================

-- Nouveaux types de documents (supports rattachés à une session).
-- ALTER TYPE ... ADD VALUE : les valeurs ne sont utilisables qu'une fois la
-- transaction validée — d'où leur ajout ici, avant tout usage applicatif.
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'support_pedagogique';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'diaporama';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'exercice';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'ressource';

-- Visibilité : par défaut le plus restrictif (formateur seul)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS visibilite TEXT NOT NULL DEFAULT 'formateur';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_visibilite_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_visibilite_check
      CHECK (visibilite IN ('formateur', 'stagiaires', 'tous'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_session_visibilite
  ON documents(session_id, visibilite);

-- Déroulé pédagogique de la session (objectifs, modules, consignes)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS deroule_pedagogique TEXT;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS materiel_necessaire TEXT;
