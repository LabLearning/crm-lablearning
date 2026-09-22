-- ============================================================
-- 157 — Commissions d'apporteur d'affaires calculées par session
--
-- Jusqu'ici la table commissions ne connaissait que le lead : impossible de
-- dire à un apporteur ce qu'il touche sur chaque formation réalisée chez les
-- établissements qu'il a apportés. Chaque session terminée d'un client
-- rattaché à un apporteur donne désormais une ligne : base retenue, taux,
-- montant, et un état qui suit l'encaissement (en attente, à verser, versée).
-- ============================================================

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS poei_id uuid REFERENCES poei(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS libelle text,
  ADD COLUMN IF NOT EXISTS date_session date,
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS mode_calcul text;

-- Une seule ligne par apporteur et par session
CREATE UNIQUE INDEX IF NOT EXISTS uq_commissions_apporteur_session
  ON commissions(apporteur_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_apporteur_status ON commissions(apporteur_id, status);

COMMENT ON COLUMN commissions.origine IS 'session (formation réalisée), poei (parcours), lead (ancien modèle)';
COMMENT ON COLUMN commissions.status IS 'en_attente (session terminée, pas encore encaissée), validee (à verser), payee (versée), annulee';

NOTIFY pgrst, 'reload schema';
