-- ============================================================
-- 157 — Commissions d'apporteur d'affaires calculées par session
--
-- Jusqu'ici la table commissions ne connaissait que le lead : impossible de
-- dire à un apporteur ce qu'il touche sur chaque formation réalisée chez les
-- établissements qu'il a apportés. Chaque session terminée d'un client
-- rattaché à un apporteur donne désormais une ligne : base retenue, taux,
-- montant, et un état qui suit l'encaissement (en attente, à verser, versée).
--
-- La table est recréée si elle manque (définition de la migration 002), pour
-- qu'un projet où elle n'aurait jamais été créée passe aussi.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  apporteur_id UUID NOT NULL REFERENCES public.apporteurs_affaires(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  montant_base DECIMAL(12,2) NOT NULL,
  taux_applique DECIMAL(5,2),
  montant_commission DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_attente',
  date_validation TIMESTAMPTZ,
  date_paiement TIMESTAMPTZ,
  reference_paiement TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commissions_apporteur ON public.commissions(apporteur_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(organization_id, status);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS poei_id uuid REFERENCES public.poei(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS libelle text,
  ADD COLUMN IF NOT EXISTS date_session date,
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS mode_calcul text;

-- Une seule ligne par apporteur et par session
CREATE UNIQUE INDEX IF NOT EXISTS uq_commissions_apporteur_session
  ON public.commissions(apporteur_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_apporteur_status ON public.commissions(apporteur_id, status);

COMMENT ON COLUMN public.commissions.origine IS 'session (formation réalisée), poei (parcours), lead (ancien modèle)';
COMMENT ON COLUMN public.commissions.status IS 'en_attente (session terminée, pas encore encaissée), validee (à verser), payee (versée), annulee';

NOTIFY pgrst, 'reload schema';
