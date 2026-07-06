-- ============================================================
-- Migration 063 : Suivi du financement France Travail (POEI)
-- Demandé (date_depot_ft, existant) → Accordé (date_accord_ft, existant)
-- → Mise en paiement → Paiement reçu (+ montant encaissé)
-- ============================================================

ALTER TABLE poei ADD COLUMN IF NOT EXISTS date_mise_en_paiement DATE;
ALTER TABLE poei ADD COLUMN IF NOT EXISTS date_paiement DATE;
ALTER TABLE poei ADD COLUMN IF NOT EXISTS montant_paye NUMERIC;
