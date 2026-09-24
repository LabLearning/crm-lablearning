-- ============================================================
-- 160 — Inscription des formateurs par un lien général
--
-- Un seul lien, le même pour tous : le formateur y saisit ses coordonnées,
-- son statut, ses domaines, certifications, zone, disponibilités, tarifs et
-- son CV. Sa fiche est créée (ou complétée) directement dans le CRM.
-- ============================================================

-- Jeton du lien général, par organisation (régénérable pour couper un lien diffusé)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS inscription_formateur_token TEXT UNIQUE;
UPDATE public.organizations
  SET inscription_formateur_token = replace(gen_random_uuid()::text, '-', '')
  WHERE inscription_formateur_token IS NULL;

-- Fiche formateur : origine, vérification, disponibilités
ALTER TABLE public.formateurs
  ADD COLUMN IF NOT EXISTS inscrit_via_formulaire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS a_verifier BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disponibilites TEXT;

-- Chaque envoi du formulaire, tel quel : traçabilité (compétences déclarées,
-- CV daté) et différences avec une fiche existante, jamais écrasée en silence
CREATE TABLE IF NOT EXISTS public.formateur_inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  formateur_id UUID REFERENCES public.formateurs(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  payload JSONB NOT NULL,
  cv_path TEXT,
  resultat TEXT NOT NULL CHECK (resultat IN ('cree', 'complete')),
  -- Champs déjà renseignés sur la fiche et que le formateur déclare autrement
  differences JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_formateur_inscriptions_formateur ON public.formateur_inscriptions(formateur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_formateur_inscriptions_email ON public.formateur_inscriptions(organization_id, email, created_at DESC);
ALTER TABLE public.formateur_inscriptions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
