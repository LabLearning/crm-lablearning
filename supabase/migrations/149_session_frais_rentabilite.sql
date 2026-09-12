-- ============================================================
-- 149 — Frais annexes des sessions (rentabilité)
--
-- La marge d'une session déduit du CA le coût formateur, les commissions et
-- les frais payés en plus (déplacement, hébergement, repas, salle, matériel,
-- supports, sous-traitance). Seuls sessions.cout_salle et cout_materiel
-- existaient, jamais remplis (0 sur 516 au 11/09/2026). Une ligne par
-- dépense, au montant réellement payé TVA comprise : l'organisme, exonéré,
-- ne récupère pas la TVA.
-- Ajoute aussi la TVA facturée par chaque formateur, pour passer d'un
-- contrat HT au coût réel.
-- ============================================================

CREATE TABLE IF NOT EXISTS session_frais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  categorie text NOT NULL CHECK (categorie IN
    ('deplacement','hebergement','repas','salle','materiel','supports','sous_traitance','autre')),
  libelle text NOT NULL CHECK (char_length(btrim(libelle)) BETWEEN 1 AND 120),
  montant numeric(12,2) NOT NULL CHECK (montant > 0),
  date_frais date,
  formateur_id uuid REFERENCES formateurs(id) ON DELETE SET NULL,
  justificatif_path text,
  justificatif_nom text,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_frais_session ON session_frais(session_id);
CREATE INDEX IF NOT EXISTS idx_session_frais_org ON session_frais(organization_id, date_frais);

DROP TRIGGER IF EXISTS tr_session_frais_updated_at ON session_frais;
CREATE TRIGGER tr_session_frais_updated_at
  BEFORE UPDATE ON session_frais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sans politique : seule la clé de service y accède, comme commissions_sessions
-- et dossiers_agefice. Une politique « membres de l'organisation » ouvrirait
-- les coûts aux comptes formateurs par la clé anon publiée dans le navigateur.
ALTER TABLE session_frais ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE session_frais IS 'Frais annexes payés pour une session, déduits de la marge.';
COMMENT ON COLUMN session_frais.montant IS 'Montant réellement payé, TVA comprise (non récupérable par l''organisme)';
COMMENT ON COLUMN session_frais.justificatif_path IS 'Chemin dans le bucket privé documents';

-- Reprise des anciens champs de la fiche session, en un seul bloc (tout ou rien)
DO $$
BEGIN
  INSERT INTO session_frais (organization_id, session_id, categorie, libelle, montant)
  SELECT s.organization_id, s.id, 'salle', 'Salle (repris de la fiche session)', s.cout_salle
  FROM sessions s
  WHERE s.cout_salle > 0
    AND NOT EXISTS (SELECT 1 FROM session_frais f
                    WHERE f.session_id = s.id AND f.libelle = 'Salle (repris de la fiche session)');
  INSERT INTO session_frais (organization_id, session_id, categorie, libelle, montant)
  SELECT s.organization_id, s.id, 'materiel', 'Matériel (repris de la fiche session)', s.cout_materiel
  FROM sessions s
  WHERE s.cout_materiel > 0
    AND NOT EXISTS (SELECT 1 FROM session_frais f
                    WHERE f.session_id = s.id AND f.libelle = 'Matériel (repris de la fiche session)');
  UPDATE sessions SET cout_salle = NULL WHERE cout_salle > 0;
  UPDATE sessions SET cout_materiel = NULL WHERE cout_materiel > 0;
END $$;

ALTER TABLE formateurs
  ADD COLUMN IF NOT EXISTS taux_tva numeric(5,2) NOT NULL DEFAULT 0
  CHECK (taux_tva >= 0 AND taux_tva <= 30);
COMMENT ON COLUMN formateurs.taux_tva IS
  'TVA facturée par le formateur (0 = non assujetti) : coût réel = montant HT × (1 + taux/100)';

NOTIFY pgrst, 'reload schema';
