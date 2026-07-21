-- ============================================================
-- Migration 078 : distinguer session « parcours » et session d'intervention
--
-- Un projet POEI produit deux natures de sessions : le parcours (chapeau
-- administratif portant la convention, sans formateur par nature) et une
-- session par intervention, réellement animée. Rien ne les distinguait à
-- l'écran : la liste semblait comporter un doublon, et le parcours
-- déclenchait une alerte « formateur non calé » injustifiée.
-- ============================================================

CREATE OR REPLACE FUNCTION sessions_page_data(org uuid, depuis date DEFAULT NULL, jusqua date DEFAULT NULL)
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
        OR EXISTS (SELECT 1 FROM poei p WHERE p.session_id = s.id),
      -- Distingue la session « parcours » (chapeau administratif, sans
      -- formateur par nature) de la session d'intervention réellement animée
      '_poei_role', CASE
        WHEN s.poei_intervention_id IS NOT NULL THEN 'intervention'
        WHEN EXISTS (SELECT 1 FROM poei p2 WHERE p2.session_id = s.id) THEN 'parcours'
        ELSE NULL
      END
    ) ORDER BY s.date_debut DESC)
    FROM sessions s
    WHERE s.organization_id = org
      AND (depuis IS NULL OR s.date_fin >= depuis OR s.date_fin IS NULL)
      AND (jusqua IS NULL OR s.date_fin < jusqua)
    ), '[]'::jsonb),
  'formations', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'intitule', intitule, 'reference', reference,
      'modalite', modalite, 'duree_heures', duree_heures, 'duree_jours', duree_jours) ORDER BY intitule)
    FROM formations WHERE organization_id = org AND is_active), '[]'::jsonb),
  'formateurs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'prenom', prenom, 'nom', nom,
      'tarif_journalier', tarif_journalier, 'zone_intervention', zone_intervention) ORDER BY nom)
    FROM formateurs WHERE organization_id = org AND is_active), '[]'::jsonb),
  'clients', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'raison_sociale', raison_sociale,
      'siret', siret, 'adresse', adresse, 'code_postal', code_postal, 'ville', ville) ORDER BY raison_sociale)
    FROM clients WHERE organization_id = org AND type::text = 'entreprise'), '[]'::jsonb),
  'apprenants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'prenom', prenom, 'nom', nom,
      'email', email, 'client_id', client_id) ORDER BY nom)
    FROM apprenants WHERE organization_id = org), '[]'::jsonb)
)
$$;
