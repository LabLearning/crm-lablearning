-- ============================================================
-- Migration 066 : données de la page Sessions en UNE requête SQL
-- Remplace 8 requêtes réseau (dont 2 avec .in() de 371 UUIDs dans
-- l'URL) et corrige le plafond PostgREST de 1000 lignes qui
-- tronquait inscriptions (1705) et apprenants (1220).
-- ============================================================

CREATE OR REPLACE FUNCTION sessions_page_data(org uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
SELECT jsonb_build_object(
  'sessions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'reference', s.reference, 'intitule', s.intitule, 'status', s.status,
      'date_debut', s.date_debut, 'date_fin', s.date_fin,
      'horaires', s.horaires, 'horaires_jours', s.horaires_jours,
      'lieu', s.lieu, 'adresse', s.adresse, 'code_postal', s.code_postal, 'ville', s.ville,
      'modalite', s.modalite, 'type_session', s.type_session, 'lien_visio', s.lien_visio,
      'places_min', s.places_min, 'places_max', s.places_max,
      'cout_formateur', s.cout_formateur, 'cout_salle', s.cout_salle, 'cout_materiel', s.cout_materiel,
      'notes_internes', s.notes_internes,
      'formation_id', s.formation_id, 'formateur_id', s.formateur_id, 'client_id', s.client_id,
      'formation', (SELECT jsonb_build_object('intitule', f.intitule, 'reference', f.reference,
        'modalite', f.modalite, 'duree_heures', f.duree_heures, 'is_poei', f.is_poei)
        FROM formations f WHERE f.id = s.formation_id),
      'formateur', (SELECT jsonb_build_object('prenom', fo.prenom, 'nom', fo.nom)
        FROM formateurs fo WHERE fo.id = s.formateur_id),
      'client', (SELECT jsonb_build_object('raison_sociale', c.raison_sociale)
        FROM clients c WHERE c.id = s.client_id),
      '_inscrits_ids', COALESCE((SELECT jsonb_agg(i.apprenant_id)
        FROM inscriptions i WHERE i.session_id = s.id AND i.status::text NOT IN ('annule','abandonne')), '[]'::jsonb),
      '_formation_ids', COALESCE((SELECT jsonb_agg(sf.formation_id ORDER BY sf.ordre)
        FROM session_formations sf WHERE sf.session_id = s.id), '[]'::jsonb),
      '_is_poei', COALESCE((SELECT f2.is_poei FROM formations f2 WHERE f2.id = s.formation_id), false)
        OR EXISTS (SELECT 1 FROM poei p WHERE p.session_id = s.id)
    ) ORDER BY s.date_debut DESC)
    FROM sessions s WHERE s.organization_id = org), '[]'::jsonb),
  'formations', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'intitule', intitule, 'reference', reference,
      'modalite', modalite, 'duree_heures', duree_heures, 'duree_jours', duree_jours) ORDER BY intitule)
    FROM formations WHERE organization_id = org AND is_active), '[]'::jsonb),
  'formateurs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'prenom', prenom, 'nom', nom,
      'tarif_journalier', tarif_journalier) ORDER BY nom)
    FROM formateurs WHERE organization_id = org AND is_active), '[]'::jsonb),
  'clients', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'raison_sociale', raison_sociale,
      'adresse', adresse, 'code_postal', code_postal, 'ville', ville) ORDER BY raison_sociale)
    FROM clients WHERE organization_id = org AND type::text = 'entreprise'), '[]'::jsonb),
  'apprenants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'prenom', prenom, 'nom', nom,
      'email', email, 'client_id', client_id) ORDER BY nom)
    FROM apprenants WHERE organization_id = org), '[]'::jsonb)
)
$$;
