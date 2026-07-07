-- ============================================================
-- Migration 065 : KPIs de la vue Manager en UNE requête SQL
-- (même principe que dashboard_kpis — 8 requêtes → 1 RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION manager_kpis(org uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
SELECT jsonb_build_object(
  'leads_total', (SELECT COUNT(*) FROM leads WHERE organization_id = org),
  'leads_mois', (SELECT COUNT(*) FROM leads WHERE organization_id = org AND created_at >= date_trunc('month', CURRENT_DATE)),
  'leads_par_statut', COALESCE((SELECT jsonb_object_agg(status, jsonb_build_object('count', c, 'montant', m))
    FROM (SELECT status::text AS status, COUNT(*) AS c, COALESCE(SUM(montant_estime), 0) AS m
          FROM leads WHERE organization_id = org GROUP BY status) x), '{}'::jsonb),
  'devis_total', (SELECT COUNT(*) FROM devis WHERE organization_id = org),
  'devis_acceptes', (SELECT COUNT(*) FROM devis WHERE organization_id = org AND status::text = 'accepte'),
  'devis_montant', COALESCE((SELECT SUM(montant_ht) FROM devis WHERE organization_id = org), 0),
  'factures_par_statut', COALESCE((SELECT jsonb_object_agg(status, c)
    FROM (SELECT status::text AS status, COUNT(*) AS c FROM factures WHERE organization_id = org GROUP BY status) x), '{}'::jsonb),
  'ca_facture', COALESCE((SELECT SUM(montant_ht) FROM factures WHERE organization_id = org AND status::text <> 'annulee'), 0),
  'ca_paye', COALESCE((SELECT SUM(montant_ht) FROM factures WHERE organization_id = org AND status::text = 'payee'), 0),
  'impayes', COALESCE((SELECT SUM(montant_ht) FROM factures WHERE organization_id = org AND status::text IN ('en_retard','relancee')), 0),
  'sessions_par_statut', COALESCE((SELECT jsonb_object_agg(status, c)
    FROM (SELECT status::text AS status, COUNT(*) AS c FROM sessions WHERE organization_id = org GROUP BY status) x), '{}'::jsonb),
  'dossiers_par_statut', COALESCE((SELECT jsonb_object_agg(status, c)
    FROM (SELECT status::text AS status, COUNT(*) AS c FROM dossiers_formation WHERE organization_id = org GROUP BY status) x), '{}'::jsonb),
  'apprenants', (SELECT COUNT(*) FROM apprenants WHERE organization_id = org),
  'reclamations_ouvertes', (SELECT COUNT(*) FROM reclamations WHERE organization_id = org AND status::text IN ('recue','en_analyse'))
)
$$;
