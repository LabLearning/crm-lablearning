-- Pack Hygiène : gabarits de documents par franchise (PMS, affichages
-- obligatoires, livret d'accueil), stockés dans le bucket privé « documents »
-- sous pack-hygiene/<org_id>/... Les indépendants et les franchises sans
-- gabarit retombent sur les gabarits de l'organisation.

ALTER TABLE franchises
  ADD COLUMN IF NOT EXISTS pms_path text,
  ADD COLUMN IF NOT EXISTS pms_personnalisable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affichages_path text,
  ADD COLUMN IF NOT EXISTS livret_path text;

COMMENT ON COLUMN franchises.pms_path IS 'Chemin storage (bucket documents) du PMS de la franchise ; null = PMS de l''organisation';
COMMENT ON COLUMN franchises.pms_personnalisable IS 'true = gabarit Lab Learning co-brandé (pages 1, 2, 6, 9 remplies par le CRM) ; false = PMS propre à la franchise, joint tel quel';
COMMENT ON COLUMN franchises.affichages_path IS 'Chemin storage des affichages obligatoires co-brandés ; null = affichages de l''organisation';
COMMENT ON COLUMN franchises.livret_path IS 'Chemin storage du livret d''accueil de la franchise ; null = livret de l''organisation';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS pms_path text,
  ADD COLUMN IF NOT EXISTS affichages_path text;

COMMENT ON COLUMN organizations.pms_path IS 'Chemin storage (bucket documents) du PMS gabarit de l''organisme';
COMMENT ON COLUMN organizations.affichages_path IS 'Chemin storage des affichages obligatoires de l''organisme';

-- Champs établissement repris sur la page « Informations sur l'établissement » du PMS
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS repas_par_jour integer,
  ADD COLUMN IF NOT EXISTS referent_haccp text;

COMMENT ON COLUMN clients.repas_par_jour IS 'Nombre de repas moyen par jour (PMS)';
COMMENT ON COLUMN clients.referent_haccp IS 'Personne référente HACCP, nom et fonction (PMS)';
