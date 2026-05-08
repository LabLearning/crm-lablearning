-- ============================================================
-- 030 — Accord prise en charge OPCO (upload PDF)
-- ============================================================
-- Le gestionnaire peut, à tout moment du workflow OPCO :
--   1. Saisir/modifier le numéro de dossier OPCO (déjà en place)
--   2. Uploader le PDF de l'accord de prise en charge
-- L'accord est OBLIGATOIRE pour passer en mise en paiement.

ALTER TABLE dossiers_formation
  ADD COLUMN IF NOT EXISTS accord_prise_en_charge_url TEXT,
  ADD COLUMN IF NOT EXISTS accord_prise_en_charge_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accord_prise_en_charge_filename TEXT;

COMMENT ON COLUMN dossiers_formation.accord_prise_en_charge_url IS
'URL Supabase Storage du PDF de l''accord OPCO (bucket dossiers)';

-- ============================================================
-- Bucket Supabase Storage pour les pièces des dossiers
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('dossiers', 'dossiers', false)
ON CONFLICT (id) DO NOTHING;

-- Policies basiques : service role accède en lecture/écriture (les
-- queries app utilisent toujours le service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'dossiers_service_role_all'
  ) THEN
    CREATE POLICY "dossiers_service_role_all" ON storage.objects
      FOR ALL USING (bucket_id = 'dossiers') WITH CHECK (bucket_id = 'dossiers');
  END IF;
END $$;
