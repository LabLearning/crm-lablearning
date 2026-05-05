-- ============================================================
-- 023 — Étendre la fiche Lead : mêmes infos entreprise que clients
-- ============================================================
-- Le commercial / apporteur saisit dès le premier contact toutes les
-- infos de l'entreprise (récupérées via data.gouv) + l'OPCO + le contact
-- principal (= gérant). À la conversion lead → client, tout est propagé
-- sans ressaisie.

-- Type d'entité (entreprise par défaut, particulier possible)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS type client_type DEFAULT 'entreprise';

-- Champs entreprise enrichis (mirror de la table clients)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sigle TEXT,
  ADD COLUMN IF NOT EXISTS code_naf TEXT,
  ADD COLUMN IF NOT EXISTS secteur_activite TEXT,
  ADD COLUMN IF NOT EXISTS taille_entreprise TEXT,
  ADD COLUMN IF NOT EXISTS forme_juridique TEXT,
  ADD COLUMN IF NOT EXISTS date_creation_entreprise DATE,
  ADD COLUMN IF NOT EXISTS effectif_libelle TEXT,
  ADD COLUMN IF NOT EXISTS tva_intra TEXT,
  ADD COLUMN IF NOT EXISTS est_qualiopi BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS est_organisme_formation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS site_web TEXT;

-- Financement / OPCO (mirror de clients)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS financeur_type financeur_type,
  ADD COLUMN IF NOT EXISTS opco_id UUID REFERENCES opco(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opco_compte_status opco_compte_status DEFAULT 'aucun',
  ADD COLUMN IF NOT EXISTS code_idcc TEXT,
  ADD COLUMN IF NOT EXISTS convention_collective TEXT,
  ADD COLUMN IF NOT EXISTS numero_opco TEXT;

-- Contact (le dirigeant — qualité = poste/fonction)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_civilite TEXT,
  ADD COLUMN IF NOT EXISTS contact_qualite TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_opco ON leads(opco_id);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(organization_id, type);

COMMENT ON COLUMN leads.type IS 'entreprise | particulier (mirror clients.type)';
COMMENT ON COLUMN leads.opco_id IS 'OPCO de rattachement détecté ou choisi manuellement';
COMMENT ON COLUMN leads.contact_qualite IS 'Fonction du contact (ex: Gérant, Président de SAS)';
