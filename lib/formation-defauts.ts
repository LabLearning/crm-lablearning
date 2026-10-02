/**
 * Rubriques pédagogiques proposées par défaut à la création d'une formation.
 * Sans elles, le programme sort sans « Méthodes et moyens », « Modalités
 * d'évaluation » ni « Modalités d'admission ». Elles restent modifiables : le
 * matériel fourni, en particulier, dépend de chaque formation.
 */
export const FORMATION_DEFAUTS = {
  methodes_pedagogiques:
    "Formation en intra-entreprise, sur le lieu de travail et l'équipement réel de l'établissement. Chaque module alterne : apports théoriques courts illustrés de cas du secteur ; démonstration par le formateur au poste de travail ; mise en pratique individuelle par le stagiaire sur son propre matériel, avec reprise des gestes non acquis ; questions-réponses ancrées dans le quotidien de l'équipe. Supports remis aux stagiaires (papier et portail en ligne). Positionnement individuel à l'entrée, évaluation des acquis en sortie ; adaptation du rythme et des modalités aux besoins repérés (niveau de français, situation de handicap : voir processus PROC-10).",
  moyens_techniques:
    'Supports pédagogiques : diaporamas interactifs, fiches méthodologiques, outils numériques.\nAteliers pratiques : exercices sur site ou cas pratiques simulés.',
  modalites_evaluation:
    'Évaluation initiale des connaissances (diagnostic).\nContrôle continu par exercices pratiques et mises en situation.\nÉvaluation finale : quiz, validation des acquis, et synthèse.',
  modalites_admission:
    "Inscription via formulaire ou contact téléphonique.\nDélai d'accès : selon les disponibilités",
} as const
