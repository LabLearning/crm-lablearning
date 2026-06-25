-- ════════════════════════════════════════════════════════════════════
-- 051 — Champs Dendreo complémentaires repris dans le CRM
--
-- Champs présents et renseignés côté Dendreo, sans équivalent CRM jusqu'ici :
--   • participants.statut_bpf      → apprenants.statut_bpf   (catégorie BPF, 100% rempli)
--   • formateurs.num_da            → formateurs.numero_da    (n° déclaration d'activité)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE apprenants  ADD COLUMN IF NOT EXISTS statut_bpf TEXT;
ALTER TABLE formateurs  ADD COLUMN IF NOT EXISTS numero_da  TEXT;
