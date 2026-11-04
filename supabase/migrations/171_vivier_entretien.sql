-- 171 — Entretien de présélection téléphonique d'un candidat du vivier
--
-- Demande de Brahim du 04/11/2026, à partir de la fiche « Chamas Tacos
-- Cagnes-sur-Mer », généralisée à tous les candidats : trame d'appel,
-- contrat proposé (CDI, CDD ou apprentissage ; 24 h ou 35 h), réponses et
-- observations par partie, six critères notés sur 4 (total sur 24), points
-- forts, points à approfondir et décision. Structure : lib/entretien-candidat.ts.

ALTER TABLE candidats_vivier
  ADD COLUMN IF NOT EXISTS entretien jsonb,
  ADD COLUMN IF NOT EXISTS entretien_le timestamptz;

COMMENT ON COLUMN candidats_vivier.entretien IS
  'Entretien de présélection téléphonique (lib/entretien-candidat.ts) : contrat proposé, réponses, observations, notes sur 4, décision';
COMMENT ON COLUMN candidats_vivier.entretien_le IS
  'Dernier enregistrement de l''entretien de présélection';
