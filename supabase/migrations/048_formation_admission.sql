-- ============================================================
-- 048 — Formations : modalités d'admission
-- ============================================================
-- Section « Informations sur l'admission » des programmes de formation
-- (élément standard Qualiopi). Champ dédié + remplissage des 2 POEI NST.
-- ============================================================

ALTER TABLE formations ADD COLUMN IF NOT EXISTS modalites_admission TEXT;

UPDATE formations
SET modalites_admission = 'L''admission est réalisée après analyse du besoin de l''entreprise, vérification des prérequis du candidat et validation de l''adéquation entre son profil, son projet professionnel, le poste visé et les objectifs de la formation. Elle peut comprendre un entretien, un positionnement initial et une validation conjointe avec l''entreprise et les prescripteurs concernés dans le cadre de la POEI.'
WHERE reference = 'POEI-NST-140';

UPDATE formations
SET modalites_admission = 'L''admission est réalisée après analyse du besoin de l''entreprise, vérification des prérequis du candidat et validation de l''adéquation entre son profil, son projet professionnel, le poste visé et les objectifs de formation. Elle peut comprendre un entretien, un positionnement initial et une validation conjointe avec l''entreprise, France Travail et les financeurs concernés dans le cadre de la POEI.'
WHERE reference = 'POEI-NST-210';
