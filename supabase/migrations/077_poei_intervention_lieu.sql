-- ============================================================
-- Migration 077 : lieu et horaires d'une intervention POEI
--
-- Ces colonnes figuraient dans la migration 071, mais y ont été ajoutées
-- APRÈS son exécution en base : elles n'existent donc pas en production.
-- Sans elles, la session de l'intervention, la convocation des stagiaires
-- et la feuille d'émargement sont sans adresse ni horaires.
-- ============================================================

ALTER TABLE poei_interventions ADD COLUMN IF NOT EXISTS lieu text;
ALTER TABLE poei_interventions ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE poei_interventions ADD COLUMN IF NOT EXISTS code_postal text;
ALTER TABLE poei_interventions ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE poei_interventions ADD COLUMN IF NOT EXISTS horaires text;
