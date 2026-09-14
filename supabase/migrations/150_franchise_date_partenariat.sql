-- ============================================================
-- 150 — Périmètre de commission d'une franchise
--
-- Un réseau amène des établissements que Lab Learning formait déjà avant
-- l'accord de commission : ces dossiers ne doivent rien à la franchise.
-- Sans repère en base, le calcul commissionnait tout l'historique (Chamas :
-- 1 377,50 € sur CB5, L'Oasis, Lomou et HG Tacos, antérieurs au premier
-- dossier du partenariat, French Cook le 27 octobre 2025).
--
-- Deux règles, parce que la date seule ne suffit pas : un établissement
-- d'avant le partenariat peut revenir se former après (CB5 en novembre 2025,
-- 3B en décembre) sans pour autant entrer dans l'accord.
--   1. franchises.date_partenariat : toute session antérieure sort du calcul.
--   2. clients.franchise_hors_partenariat : l'établissement entier en sort,
--      quelle que soit la date de ses sessions.
-- Une session écartée ne génère aucune commission, comme une POEI ou une
-- session sans inscrit.
-- ============================================================

ALTER TABLE franchises ADD COLUMN IF NOT EXISTS date_partenariat date;
COMMENT ON COLUMN franchises.date_partenariat IS
  'Première date ouvrant droit à commission ; les sessions antérieures sont hors partenariat. NULL = tout l''historique compte.';

ALTER TABLE clients ADD COLUMN IF NOT EXISTS franchise_hors_partenariat boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN clients.franchise_hors_partenariat IS
  'true = établissement rattaché au réseau mais hors accord de commission, quelle que soit la date de ses sessions.';

CREATE INDEX IF NOT EXISTS idx_clients_hors_partenariat
  ON clients(franchise_id) WHERE franchise_hors_partenariat;

-- Chamas Tacos : premier dossier du partenariat le 27/10/2025 (French Cook),
-- périmètre confirmé par Brahim le 14/09/2026.
UPDATE franchises SET date_partenariat = DATE '2025-10-27'
WHERE nom = 'Chamas Tacos' AND date_partenariat IS NULL;

-- CB5 et 3B se sont formés avant l'accord puis sont revenus : hors périmètre.
UPDATE clients SET franchise_hors_partenariat = true
WHERE siret IN (
  '88860476600012', -- CB5 (Lyon)
  '90136714400010'  -- 3B (Villeurbanne)
);

-- Les commissions hors périmètre n'ont plus lieu d'être : seules les non
-- figées partent, une commission validée ou payée se corrige à la main.
DELETE FROM commissions_sessions cs
USING sessions s, franchises f, clients c
WHERE cs.session_id = s.id
  AND cs.franchise_id = f.id
  AND cs.client_id = c.id
  AND cs.status NOT IN ('validee', 'payee')
  AND (
    c.franchise_hors_partenariat
    OR (f.date_partenariat IS NOT NULL AND s.date_debut < f.date_partenariat)
  );

NOTIFY pgrst, 'reload schema';
