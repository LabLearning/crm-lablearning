-- ============================================================
-- Migration 064 : KPIs du tableau de bord en UNE requête SQL
-- Remplace 13 requêtes réseau par un seul appel RPC : toutes les
-- agrégations sont faites côté Postgres (payload minuscule).
-- ============================================================

CREATE OR REPLACE FUNCTION dashboard_kpis(org uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH f AS (
  SELECT montant_ttc, montant_paye, montant_restant, status::text AS status, date_emission, date_echeance
  FROM factures WHERE organization_id = org AND status::text <> 'annulee' AND type::text <> 'avoir'
),
l AS (SELECT status::text AS status, montant_estime FROM leads WHERE organization_id = org),
s AS (SELECT status::text AS status, date_debut, date_fin FROM sessions WHERE organization_id = org),
i AS (SELECT status::text AS status, date_inscription FROM inscriptions WHERE organization_id = org),
mois12 AS (
  SELECT date_trunc('month', gs)::date AS m
  FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month') gs
)
SELECT jsonb_build_object(
  'ca_realise', COALESCE((SELECT SUM(montant_ttc) FROM f), 0),
  'ca_mois', COALESCE((SELECT SUM(montant_ttc) FROM f WHERE date_emission >= date_trunc('month', CURRENT_DATE)), 0),
  'encaisse', COALESCE((SELECT SUM(montant_paye) FROM f), 0),
  'impaye', COALESCE((SELECT SUM(montant_restant) FROM f WHERE status IN ('emise','envoyee','payee_partiellement','en_retard')), 0),
  'factures_en_retard', (SELECT COUNT(*) FROM f WHERE status IN ('emise','envoyee','payee_partiellement') AND date_echeance < CURRENT_DATE),
  'ca_mensuel', (
    SELECT jsonb_agg(jsonb_build_object('mois', to_char(m.m, 'YYYY-MM'), 'montant',
      COALESCE((SELECT SUM(montant_ttc) FROM f WHERE date_trunc('month', date_emission::date) = m.m), 0)) ORDER BY m.m)
    FROM mois12 m
  ),
  'leads_total', (SELECT COUNT(*) FROM l),
  'leads_par_status', COALESCE((SELECT jsonb_object_agg(status, c) FROM (SELECT status, COUNT(*) AS c FROM l GROUP BY status) x), '{}'::jsonb),
  'leads_valeur', COALESCE((SELECT SUM(montant_estime) FROM l WHERE status <> 'perdu'), 0),
  'leads_gagnes', (SELECT COUNT(*) FROM l WHERE status = 'gagne'),
  'devis_en_attente', (SELECT COUNT(*) FROM devis WHERE organization_id = org AND status::text = 'envoye'),
  'devis_valeur', COALESCE((SELECT SUM(montant_ttc) FROM devis WHERE organization_id = org AND status::text = 'envoye'), 0),
  'sessions_en_cours', (SELECT COUNT(*) FROM s WHERE status = 'en_cours' OR (date_debut <= CURRENT_DATE AND date_fin >= CURRENT_DATE AND status = 'confirmee')),
  'sessions_a_venir', (SELECT COUNT(*) FROM s WHERE date_debut > CURRENT_DATE AND status IN ('planifiee','confirmee')),
  'sessions_terminees', (SELECT COUNT(*) FROM s WHERE status = 'terminee'),
  'apprenants_formes', (SELECT COUNT(*) FROM i WHERE status = 'complete'),
  'apprenants_en_cours', (SELECT COUNT(*) FROM i WHERE status IN ('inscrit','confirme','en_cours')),
  'inscriptions_mensuelles', (
    SELECT jsonb_agg(jsonb_build_object('mois', to_char(m.m, 'YYYY-MM'), 'count',
      (SELECT COUNT(*) FROM i WHERE date_trunc('month', date_inscription::date) = m.m)) ORDER BY m.m)
    FROM mois12 m
  ),
  'taux_satisfaction', COALESCE((SELECT ROUND(AVG(note_moyenne) * 20) FROM evaluations_satisfaction WHERE organization_id = org), 0),
  'taux_reussite', COALESCE((SELECT ROUND(100.0 * SUM(CASE WHEN is_reussi THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) FROM qcm_reponses WHERE organization_id = org AND is_complete), 0),
  'reclamations_ouvertes', (SELECT COUNT(*) FROM reclamations WHERE organization_id = org AND status::text <> 'cloturee'),
  'conformite_qualiopi', COALESCE((SELECT ROUND(100.0 * SUM(CASE WHEN niveau::text = 'conforme' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) FROM qualiopi_indicateurs WHERE organization_id = org AND niveau::text <> 'non_applicable'), 0),
  'habilitations_a_renouveler', (SELECT COUNT(*) FROM formateurs WHERE organization_id = org AND is_active AND prochaine_mise_a_jour < CURRENT_DATE + 30),
  'activite_recente', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'action', a.action, 'entity_type', a.entity_type, 'created_at', a.created_at,
      'user_name', COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), 'Système')
    ) ORDER BY a.created_at DESC)
    FROM (SELECT action, entity_type, created_at, user_id FROM audit_logs WHERE organization_id = org ORDER BY created_at DESC LIMIT 10) a
    LEFT JOIN users u ON u.id = a.user_id
  ), '[]'::jsonb)
)
$$;
