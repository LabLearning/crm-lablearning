-- 042 — WhatsApp + opt-in sur les formateurs (pour les liens de signature contrat)
ALTER TABLE formateurs
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE;
