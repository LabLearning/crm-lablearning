-- ============================================================
-- 170 — Campagnes : nouveaux publics
--
-- Demande de Brahim du 25/10/2026 : cibler les franchisés, les têtes de
-- réseau, tous les clients, par ville ou par formation. Les envois gardent
-- le type de la personne écrite : en plus des leads et des contacts, la fiche
-- d'un client sans contact (son e-mail ou son mobile), le référent d'une
-- franchise, un compte du portail franchise et un apporteur d'affaires.
-- Sans cette migration, une campagne qui les vise ne se lance pas (le CRM le
-- dit). À coller d'un bloc dans l'éditeur SQL de Supabase.
-- ============================================================

ALTER TABLE public.campagne_envois DROP CONSTRAINT IF EXISTS campagne_envois_personne_type_check;
ALTER TABLE public.campagne_envois ADD CONSTRAINT campagne_envois_personne_type_check
  CHECK (personne_type IN ('lead', 'contact', 'client', 'franchise', 'utilisateur', 'apporteur'));

NOTIFY pgrst, 'reload schema';
