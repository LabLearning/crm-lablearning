-- ============================================================
-- 153 — Facture hors affacturage
--
-- L'affacturage est réglé au niveau de l'organisme : dès qu'il est actif,
-- toute facture adressée à un financeur porte la mention de cession de
-- créance et l'IBAN du factor. Certaines factures doivent pourtant être
-- réglées directement à l'organisme (client qui paie lui-même, dossier que
-- l'on ne cède pas). Le drapeau se pose facture par facture, à la génération
-- depuis la session ou après coup, tant que la créance n'a pas été cédée.
-- ============================================================

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS sans_affacturage boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN factures.sans_affacturage IS
  'Vrai : la facture est réglée à l''organisme, sans mention de cession ni IBAN du factor, même si l''affacturage est actif.';

NOTIFY pgrst, 'reload schema';
