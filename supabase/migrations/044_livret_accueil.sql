-- 044_livret_accueil.sql
-- Livret d'accueil : document fixe de l'organisme, envoyé aux apprenants J-1 avant la formation.

-- Document fixe stocké au niveau de l'organisme (comme le tampon de signature)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS livret_accueil_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS livret_accueil_filename text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS livret_accueil_uploaded_at timestamptz;

-- Marqueur d'envoi par session (évite les doublons du cron J-1)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS livret_sent_at timestamptz;
