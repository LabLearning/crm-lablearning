-- ============================================================
-- Migration 074 : état civil complet des participants
--
-- Deux manques : le lieu de naissance n'existait nulle part, et la table
-- `apprenants` ne portait ni n° de sécurité sociale, ni adresse, ni type
-- de contrat. Ces informations, saisies sur le lead, étaient donc PERDUES
-- à la conversion du participant en apprenant — alors qu'elles sont
-- exigées dans les dossiers de prise en charge (OPCO, France Travail).
-- ============================================================

-- Participants prévus (au stade du lead)
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS lieu_naissance text;
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS code_postal text;
ALTER TABLE lead_participants ADD COLUMN IF NOT EXISTS ville text;

-- Apprenants (après conversion)
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS numero_securite_sociale text;
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS lieu_naissance text;
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS code_postal text;
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS type_contrat text;

COMMENT ON COLUMN apprenants.numero_securite_sociale IS
  'Donnée sensible : exigée par les financeurs, à ne jamais exposer dans un portail public.';
