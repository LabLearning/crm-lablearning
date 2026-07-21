-- ============================================================
-- Migration 072 : types de documents « entreprise »
-- La fiche client accueille désormais les pièces administratives
-- de la société (Kbis, courriers OPCO/AKTO, URSSAF, RIB…) qui
-- n'entraient dans aucun des types orientés formation.
-- ============================================================

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'kbis';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'courrier_opco';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'attestation_urssaf';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'rib';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'piece_identite';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'assurance';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'statuts';
