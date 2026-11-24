-- ============================================================
-- 174 — Paiement des frais annexes
--
-- Demande de Brahim du 24/11/2026 : dans l'onglet Frais d'une POEI (et de
-- toute session), une pastille « Payé » pour noter les frais réglés.
-- paye_le vide = frais encore à payer. La marge et les commissions ne
-- changent pas : elles comptent déjà chaque frais, payé ou non.
-- À coller d'un bloc dans l'éditeur SQL de Supabase.
-- ============================================================

ALTER TABLE public.session_frais
  ADD COLUMN IF NOT EXISTS paye_le date,
  ADD COLUMN IF NOT EXISTS paye_par uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.session_frais.paye_le IS 'Date du règlement du frais ; vide = encore à payer';
COMMENT ON COLUMN public.session_frais.paye_par IS 'Utilisateur qui a noté le règlement';

-- Rien n'est ouvert à anon ni à authenticated (migration 164) : on le redit
REVOKE ALL ON public.session_frais FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
