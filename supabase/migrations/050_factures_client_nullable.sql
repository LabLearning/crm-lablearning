-- ════════════════════════════════════════════════════════════════════
-- 050 — Factures : client_id nullable (factures adressées à un financeur)
--
-- De nombreuses factures Dendreo sont émises au nom d'un OPCO / financeur
-- (ex. « AKTO - ILE DE FRANCE ») et non d'une entreprise cliente. Le payeur
-- est alors stocké dans factures.financeur_nom. On lève donc la contrainte
-- NOT NULL sur factures.client_id.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE factures ALTER COLUMN client_id DROP NOT NULL;
