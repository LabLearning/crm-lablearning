-- ============================================================
-- 154 — Compte OPCO du client : date et identifiant de connexion
--
-- Le statut du compte (clients.opco_compte_status, migration 017) et les
-- identifiants chiffrés (opco_compte_chiffre, migration 098) existaient sans
-- être visibles. Pour piloter les dossiers AKTO depuis la fiche client et
-- chaque session, il manque la date du dernier changement d'état (le jour
-- de création du compte, en pratique) et l'identifiant de connexion en
-- clair : ce n'est pas un secret (SIRET ou email), le mot de passe reste
-- dans le coffre chiffré.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS opco_compte_date date,
  ADD COLUMN IF NOT EXISTS opco_compte_identifiant text;

COMMENT ON COLUMN clients.opco_compte_date IS
  'Date du dernier changement d''état du compte OPCO (création du compte, validation, désactivation).';
COMMENT ON COLUMN clients.opco_compte_identifiant IS
  'Identifiant de connexion au portail OPCO, en clair. Le mot de passe est dans opco_compte_chiffre.';

NOTIFY pgrst, 'reload schema';
